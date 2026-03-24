import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Globe, FileText, Trash2, Copy, Check, Key, CheckSquare, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { extractJWTFromHeaders } from "@/lib/jwt";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CapturedRequest, DomainGroup, PageSession } from "@/types/request";
import { safePathname } from "@/lib/url";
import { formatDuration } from "@/lib/format";
import { getStatusDotColor, getGroupStatusColor } from "@/lib/status";
import { buildPageSummaryJson, buildDomainSummaryJson } from "@/lib/request-utils";

interface SessionsViewProps {
  domainGroups: DomainGroup[];
  onSelectRequest: (request: CapturedRequest) => void;
  selectedRequest: CapturedRequest | null;
  onClearDomain: (domain: string) => void;
  onClearPage: (pageUrl: string) => void;
  jwtHeaders: string[];
  tokenPrefixes: string[];
}

function findDomainJwt(domain: DomainGroup, jwtHeaders: string[], tokenPrefixes: string[]) {
  for (const page of domain.pages ?? []) {
    const requests = page.requests ?? [];
    for (let i = requests.length - 1; i >= 0; i--) {
      const jwt = extractJWTFromHeaders(requests[i].requestHeaders, jwtHeaders, tokenPrefixes);
      if (jwt) return jwt;
    }
  }
  return null;
}

// Generate URL pattern for grouping
function generateUrlPattern(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    const patternParts = pathParts.map((part) => {
      if (/^\d+$/.test(part)) return ":id";
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) return ":uuid";
      if (/^[0-9a-f]{24}$/i.test(part)) return ":objectId";
      return part;
    });
    return `/${patternParts.join("/")}`;
  } catch {
    return url;
  }
}

interface RequestGrouping {
  pattern: string;
  requests: CapturedRequest[];
  count: number;
  avgDuration: number;
}

// Group requests by URL pattern
function groupRequestsByPattern(requests: CapturedRequest[]): RequestGrouping[] {
  const groups = new Map<string, CapturedRequest[]>();
  
  for (const request of requests) {
    const pattern = generateUrlPattern(request.url);
    const existing = groups.get(pattern) ?? [];
    groups.set(pattern, [...existing, request]);
  }
  
  return Array.from(groups.entries())
    .map(([pattern, reqs]) => ({
      pattern,
      requests: reqs.sort((a, b) => a.startTime - b.startTime),
      count: reqs.length,
      avgDuration: reqs.reduce((sum, r) => sum + r.duration, 0) / reqs.length,
    }))
    .sort((a, b) => b.count - a.count);
}

function RequestRow({
  request,
  isSelected,
  onClick,
}: {
  request: CapturedRequest;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 text-xs border-b border-border/30",
        isSelected && "bg-accent"
      )}
      onClick={onClick}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", getStatusDotColor(request.status))} />
      <span className="w-10 text-muted-foreground font-mono">{request.method}</span>
      <span className="flex-1 truncate font-mono" title={request.url}>
        {safePathname(request.url)}
      </span>
      <span className="text-muted-foreground">{formatDuration(request.duration)}</span>
    </div>
  );
}

function GroupedRequestRow({
  group,
  onSelectRequest,
  selectedRequest,
}: {
  group: RequestGrouping;
  onSelectRequest: (request: CapturedRequest) => void;
  selectedRequest: CapturedRequest | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMultiple = group.count > 1;

  // Get "worst" status for the group
  const getGroupStatus = () => {
    let hasError = false, hasWarning = false;
    for (const r of group.requests) {
      if (r.status >= 500) hasError = true;
      else if (r.status >= 400) hasWarning = true;
    }
    if (hasError) return "bg-red-500";
    if (hasWarning) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (!hasMultiple) {
    const req = group.requests[0];
    return (
      <RequestRow
        request={req}
        isSelected={selectedRequest?.id === req.id}
        onClick={() => onSelectRequest(req)}
      />
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/30 text-xs border-b border-border/30"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", getGroupStatus())} />
        <span className="text-muted-foreground font-mono">{group.count}x</span>
        <span className="flex-1 truncate font-mono" title={group.pattern}>
          {group.pattern}
        </span>
        <span className="text-muted-foreground">avg {formatDuration(group.avgDuration)}</span>
      </div>
      {expanded && (
        <div className="pl-4">
          {group.requests.map((req) => (
            <RequestRow
              key={req.id}
              request={req}
              isSelected={selectedRequest?.id === req.id}
              onClick={() => onSelectRequest(req)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PageSessionView({
  page,
  onSelectRequest,
  selectedRequest,
  onClear,
  isChecked,
  onToggleSelect,
}: {
  page: PageSession;
  onSelectRequest: (request: CapturedRequest) => void;
  selectedRequest: CapturedRequest | null;
  onClear: () => void;
  isChecked: boolean;
  onToggleSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Group requests by URL pattern
  const groupedRequests = groupRequestsByPattern(page.requests ?? []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const json = JSON.stringify(buildPageSummaryJson(page), null, 2);
    const success = await copyToClipboard(json);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border-b border-border/50">
      <div
        className="flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-accent/30 text-xs"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Selection checkbox */}
        <button
          className="shrink-0 hover:text-foreground text-muted-foreground"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          title={isChecked ? "Deselect" : "Select for copy"}
        >
          {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5" />}
        </button>
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <FileText className="w-3 h-3 text-muted-foreground" />
        <span className="flex-1 truncate font-mono" title={page.path}>
          {page.path || "/"}
        </span>
        <span className="text-muted-foreground">{groupedRequests.length} endpoints · {page.requests?.length ?? 0} req</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={handleCopy}
          title="Copy page requests as JSON"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          title="Clear page requests"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      {expanded && (
        <div className="pl-6">
          {groupedRequests.map((group) => (
            <GroupedRequestRow
              key={group.pattern}
              group={group}
              onSelectRequest={onSelectRequest}
              selectedRequest={selectedRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DomainView({
  domain,
  onSelectRequest,
  selectedRequest,
  onClearDomain,
  onClearPage,
  jwtHeaders,
  tokenPrefixes,
  selectedPageIds,
  onTogglePageSelect,
}: {
  domain: DomainGroup;
  onSelectRequest: (request: CapturedRequest) => void;
  selectedRequest: CapturedRequest | null;
  onClearDomain: (domain: string) => void;
  onClearPage: (pageUrl: string) => void;
  jwtHeaders: string[];
  tokenPrefixes: string[];
  selectedPageIds: Set<string>;
  onTogglePageSelect: (pageId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [jwtCopied, setJwtCopied] = useState(false);

  const domainJwt = useMemo(() => findDomainJwt(domain, jwtHeaders, tokenPrefixes), [domain, jwtHeaders, tokenPrefixes]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const json = JSON.stringify(buildDomainSummaryJson(domain), null, 2);
    const success = await copyToClipboard(json);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyJwt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (domainJwt) {
      const success = await copyToClipboard(domainJwt.rawToken);
      if (success) {
        setJwtCopied(true);
        setTimeout(() => setJwtCopied(false), 2000);
      }
    }
  };

  return (
    <div className="border-b border-border">
      <div
        className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-accent/50 text-sm font-medium"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Globe className="w-4 h-4 text-blue-500" />
        <span className="flex-1">{domain.domain}</span>
        <span className="text-xs text-muted-foreground">
          {domain.pages.length} pages · {domain.totalRequests} req
        </span>
        {domainJwt && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleCopyJwt}
            title={`Copy JWT from ${domainJwt.header}`}
          >
            {jwtCopied ? <Check className="w-3 h-3 mr-1" /> : <Key className="w-3 h-3 mr-1" />}
            {jwtCopied ? "Copied!" : "JWT"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          title="Copy domain requests as JSON"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onClearDomain(domain.domain);
          }}
          title="Clear all domain requests"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      {expanded && (
        <div className="pl-2">
          {domain.pages.map((page) => (
            <PageSessionView
              key={page.id}
              page={page}
              onSelectRequest={onSelectRequest}
              selectedRequest={selectedRequest}
              onClear={() => onClearPage(page.pageUrl)}
              isChecked={selectedPageIds.has(page.id)}
              onToggleSelect={() => onTogglePageSelect(page.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SessionsView({
  domainGroups,
  onSelectRequest,
  selectedRequest,
  onClearDomain,
  onClearPage,
  jwtHeaders,
  tokenPrefixes,
}: SessionsViewProps) {
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Toggle page selection
  const togglePageSelect = (pageId: string) => {
    setSelectedPageIds(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  // Clear selection
  const clearSelection = () => setSelectedPageIds(new Set());

  // Get all pages for copying
  const allPages = useMemo(() => {
    const pages: PageSession[] = [];
    for (const domain of domainGroups) {
      pages.push(...domain.pages);
    }
    return pages;
  }, [domainGroups]);

  // Get pages to copy - selected if any, otherwise all
  const pagesToCopy = useMemo(() => {
    if (selectedPageIds.size > 0) {
      return allPages.filter(p => selectedPageIds.has(p.id));
    }
    return allPages;
  }, [allPages, selectedPageIds]);

  // Handle copy all/selected
  const handleCopyAll = async () => {
    const summary = pagesToCopy.map(page => buildPageSummaryJson(page));
    const json = JSON.stringify(summary, null, 2);
    const success = await copyToClipboard(json);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (domainGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <Globe className="w-12 h-12" />
        <p>No sessions captured yet</p>
        <p className="text-xs">Navigate to pages to start capturing requests</p>
      </div>
    );
  }

  const hasSelection = selectedPageIds.size > 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Copy controls bar */}
      <div className="px-2 py-2 border-b border-border flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={handleCopyAll}
        >
          {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
          {copied ? "Copied!" : hasSelection ? `Copy ${selectedPageIds.size} Selected` : `Copy All (${allPages.length})`}
        </Button>
        {hasSelection && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={clearSelection}
            title="Clear selection"
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {domainGroups.length} domains · {allPages.length} pages
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col pb-8">
          {domainGroups.map((domain) => (
            <DomainView
              key={domain.domain}
              domain={domain}
              onSelectRequest={onSelectRequest}
              selectedRequest={selectedRequest}
              onClearDomain={onClearDomain}
              onClearPage={onClearPage}
              jwtHeaders={jwtHeaders}
              tokenPrefixes={tokenPrefixes}
              selectedPageIds={selectedPageIds}
              onTogglePageSelect={togglePageSelect}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
