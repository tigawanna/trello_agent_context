import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Clock, Key, Search, X, Copy, Check, Filter, Bookmark, CheckSquare, Square, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CapturedRequest, RequestGroup } from "@/types/request";
import { extractJWTFromHeaders } from "@/lib/jwt";
import type { RequestFilters, MethodFilter, SortOption } from "@/lib/tanstackdb";
import { safePathname } from "@/lib/url";
import { formatDuration, formatSize, formatRelativeTime } from "@/lib/format";
import { getStatusDotColor, getGroupStatusColor } from "@/lib/status";
import { buildRequestsSummaryJson, getUniqueMethods } from "@/lib/request-utils";

interface RequestListProps {
  groups: RequestGroup[];
  requests: CapturedRequest[];
  filteredRequests: CapturedRequest[];
  selectedRequest: CapturedRequest | null;
  onSelectRequest: (request: CapturedRequest) => void;
  jwtHeaders: string[];
  viewMode: "grouped" | "flat";
  // Filter state from store
  filters: RequestFilters;
  setFilters: (filters: RequestFilters) => void;
  routeSegments: string[];
  // Multi-select for copy
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  // Mark/bookmark for visual tracking
  markedIds: Set<string>;
  toggleMarked: (id: string) => void;
  // Copy helper
  getRequestsForCopy: () => CapturedRequest[];
}

function RequestRow({
  request,
  isSelected,
  isChecked,
  isMarked,
  onClick,
  onToggleSelect,
  onToggleMark,
  hasJWT,
  indent = false,
}: {
  request: CapturedRequest;
  isSelected: boolean;
  isChecked: boolean;
  isMarked: boolean;
  onClick: () => void;
  onToggleSelect: () => void;
  onToggleMark: () => void;
  hasJWT: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent/50 text-sm border-b",
        isSelected && "bg-accent",
        isMarked ? "border-l-2 border-l-red-500 border-b-border/50" : "border-border/50",
        indent && "pl-6"
      )}
      onClick={onClick}
    >
      {/* Checkbox for multi-select */}
      <button
        className="shrink-0 hover:text-foreground text-muted-foreground"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        title={isChecked ? "Deselect" : "Select for copy"}
      >
        {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5" />}
      </button>
      {/* Bookmark/mark toggle */}
      <button
        className="shrink-0 hover:text-foreground text-muted-foreground"
        onClick={(e) => { e.stopPropagation(); onToggleMark(); }}
        title={isMarked ? "Unmark" : "Mark for tracking"}
      >
        <Bookmark className={cn("w-3.5 h-3.5", isMarked && "fill-red-500 text-red-500")} />
      </button>
      <span className="flex items-center gap-1.5 w-12 justify-center text-xs font-mono">
        <span className={cn("w-2 h-2 rounded-full", getStatusDotColor(request.status))} />
        {request.status}
      </span>
      <span className="w-14 text-muted-foreground font-mono text-xs">{request.method}</span>
      <span className="flex-1 truncate font-mono text-xs" title={request.url}>
        {safePathname(request.url)}
      </span>
      <div className="flex items-center gap-2 text-muted-foreground">
        {hasJWT && <span title="Contains JWT"><Key className="w-3 h-3 text-yellow-500" /></span>}
        <span className="w-14 text-right text-xs" title={new Date(request.startTime).toLocaleTimeString()}>
          {formatRelativeTime(request.startTime)}
        </span>
        <span className="w-16 text-right text-xs flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDuration(request.duration)}
        </span>
        <span className="w-14 text-right text-xs">{formatSize(request.size)}</span>
      </div>
    </div>
  );
}

interface GroupedViewProps {
  groups: RequestGroup[];
  selectedRequest: CapturedRequest | null;
  onSelectRequest: (request: CapturedRequest) => void;
  jwtHeaders: string[];
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  markedIds: Set<string>;
  toggleMarked: (id: string) => void;
}

function GroupedView({
  groups,
  selectedRequest,
  onSelectRequest,
  jwtHeaders,
  selectedIds,
  toggleSelected,
  markedIds,
  toggleMarked,
}: GroupedViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (pattern: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(pattern)) next.delete(pattern);
      else next.add(pattern);
      return next;
    });
  };

  // Toggle selection for all requests in a group
  const toggleGroupSelection = (groupRequests: CapturedRequest[]) => {
    const groupIds = groupRequests.map(r => r.id);
    const allSelected = groupIds.every(id => selectedIds.has(id));
    
    if (allSelected) {
      // Deselect all in group
      groupIds.forEach(id => {
        if (selectedIds.has(id)) toggleSelected(id);
      });
    } else {
      // Select all in group
      groupIds.forEach(id => {
        if (!selectedIds.has(id)) toggleSelected(id);
      });
    }
  };

  // Toggle mark for all requests in a group
  const toggleGroupMark = (groupRequests: CapturedRequest[]) => {
    const groupIds = groupRequests.map(r => r.id);
    const allMarked = groupIds.every(id => markedIds.has(id));
    
    if (allMarked) {
      // Unmark all in group
      groupIds.forEach(id => {
        if (markedIds.has(id)) toggleMarked(id);
      });
    } else {
      // Mark all in group
      groupIds.forEach(id => {
        if (!markedIds.has(id)) toggleMarked(id);
      });
    }
  };

  return (
    <div className="flex flex-col pb-8">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.pattern);
        const hasMultiple = group.count > 1;
        const methods = getUniqueMethods(group.requests);
        const statusColor = getGroupStatusColor(group.requests.map(r => r.status));
        const groupIds = group.requests.map(r => r.id);
        const allSelected = groupIds.every(id => selectedIds.has(id));
        const someSelected = groupIds.some(id => selectedIds.has(id));
        const allMarked = groupIds.every(id => markedIds.has(id));
        const someMarked = groupIds.some(id => markedIds.has(id));

        return (
          <div key={group.pattern}>
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent/50 text-sm border-b",
                hasMultiple && "font-medium",
                someMarked ? "border-l-2 border-l-red-500 border-b-border" : "border-border"
              )}
              onClick={() => hasMultiple ? toggleGroup(group.pattern) : onSelectRequest(group.requests[0])}
            >
              {/* Group checkbox - select all children */}
              <button
                className="shrink-0 hover:text-foreground text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); toggleGroupSelection(group.requests); }}
                title={allSelected ? "Deselect all in group" : "Select all in group"}
              >
                {allSelected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-primary" />
                ) : someSelected ? (
                  <Square className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
              </button>
              {/* Group bookmark - mark all children */}
              <button
                className="shrink-0 hover:text-foreground text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); toggleGroupMark(group.requests); }}
                title={allMarked ? "Unmark all in group" : "Mark all in group"}
              >
                <Bookmark className={cn("w-3.5 h-3.5", allMarked ? "fill-red-500 text-red-500" : someMarked ? "text-red-500" : "")} />
              </button>
              {hasMultiple ? (
                isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              ) : (
                <div className="w-4" />
              )}
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusColor)} />
              <span className="flex items-center gap-1.5 text-xs font-mono">
                {group.count}x
              </span>
              <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">
                {methods.join(", ")}
              </span>
              <span className="flex-1 truncate font-mono text-xs" title={group.pattern}>
                {safePathname(group.pattern)}
              </span>
              <span className="text-muted-foreground text-xs">
                avg {formatDuration(group.avgDuration)}
              </span>
            </div>
            {isExpanded && group.requests.map((req) => (
              <RequestRow
                key={req.id}
                request={req}
                isSelected={selectedRequest?.id === req.id}
                isChecked={selectedIds.has(req.id)}
                isMarked={markedIds.has(req.id)}
                onClick={() => onSelectRequest(req)}
                onToggleSelect={() => toggleSelected(req.id)}
                onToggleMark={() => toggleMarked(req.id)}
                hasJWT={!!extractJWTFromHeaders(req.requestHeaders, jwtHeaders)}
                indent
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function FlatView({
  requests,
  selectedRequest,
  onSelectRequest,
  jwtHeaders,
  selectedIds,
  toggleSelected,
  markedIds,
  toggleMarked,
}: {
  requests: CapturedRequest[];
  selectedRequest: CapturedRequest | null;
  onSelectRequest: (request: CapturedRequest) => void;
  jwtHeaders: string[];
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  markedIds: Set<string>;
  toggleMarked: (id: string) => void;
}) {
  return (
    <div className="flex flex-col pb-8">
      {requests.map((request) => (
        <RequestRow
          key={request.id}
          request={request}
          isSelected={selectedRequest?.id === request.id}
          isChecked={selectedIds.has(request.id)}
          isMarked={markedIds.has(request.id)}
          onClick={() => onSelectRequest(request)}
          onToggleSelect={() => toggleSelected(request.id)}
          onToggleMark={() => toggleMarked(request.id)}
          hasJWT={!!extractJWTFromHeaders(request.requestHeaders, jwtHeaders)}
        />
      ))}
    </div>
  );
}

export function RequestList({
  groups,
  requests,
  filteredRequests,
  selectedRequest,
  onSelectRequest,
  jwtHeaders,
  viewMode,
  filters,
  setFilters,
  routeSegments,
  selectedIds,
  toggleSelected,
  clearSelection,
  markedIds,
  toggleMarked,
  getRequestsForCopy,
}: RequestListProps) {
  const [copied, setCopied] = useState(false);
  const [, setTick] = useState(0);

  // Update relative times every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  // Get requests for copy - prioritizes selected rows if any
  const requestsToCopy = getRequestsForCopy();
  const copyCount = requestsToCopy.length;
  const hasSelection = selectedIds.size > 0;

  // Handle copy requests
  const handleCopyRequests = async () => {
    const summary = buildRequestsSummaryJson(requestsToCopy);
    const json = JSON.stringify(summary, null, 2);
    const success = await copyToClipboard(json);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Update individual filter fields
  const updateFilter = <K extends keyof RequestFilters>(key: K, value: RequestFilters[K]) => {
    setFilters({ ...filters, [key]: value });
  };

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <Filter className="w-12 h-12" />
        <p>No requests captured yet</p>
        <p className="text-xs">Requests will appear here as they are made</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Search and Filter Bar */}
      <div className="px-2 py-2 border-b border-border space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              placeholder="Search endpoints..."
              className="w-full pl-7 pr-7 py-1 text-xs bg-background border border-border rounded"
            />
            {filters.search && (
              <button
                onClick={() => updateFilter("search", "")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filters.method}
            onChange={(e) => updateFilter("method", e.target.value as MethodFilter)}
            className="px-2 py-1 text-xs bg-background border border-border rounded"
          >
            <option value="ALL">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
            <option value="OPTIONS">OPTIONS</option>
            <option value="HEAD">HEAD</option>
          </select>
          {routeSegments.length > 0 && (
            <select
              value={filters.segment}
              onChange={(e) => updateFilter("segment", e.target.value)}
              className="px-2 py-1 text-xs bg-background border border-border rounded max-w-30"
              title="Filter by route segment"
            >
              <option value="ALL">All Routes</option>
              {routeSegments.map((seg: string) => (
                <option key={seg} value={seg}>{seg}</option>
              ))}
            </select>
          )}
          <select
            value={filters.sortBy.replace('-asc', '').replace('-desc', '')}
            onChange={(e) => {
              const base = e.target.value;
              const isAsc = filters.sortBy.endsWith('-asc');
              updateFilter("sortBy", (base === "time" ? `time-${isAsc ? 'asc' : 'desc'}` : base) as SortOption);
            }}
            className="px-2 py-1 text-xs bg-background border border-border rounded"
          >
            <option value="time">By Time</option>
            <option value="method">By Method</option>
            <option value="status">By Status</option>
          </select>
          <button
            onClick={() => {
              const isAsc = filters.sortBy.endsWith('-asc') || filters.sortBy === 'method' || filters.sortBy === 'status';
              if (filters.sortBy.startsWith('time')) {
                updateFilter("sortBy", isAsc ? "time-desc" : "time-asc");
              }
            }}
            className={cn(
              "p-1 rounded border border-border hover:bg-accent",
              !filters.sortBy.startsWith('time') && "opacity-50 cursor-not-allowed"
            )}
            disabled={!filters.sortBy.startsWith('time')}
            title={filters.sortBy.endsWith('-asc') ? "Sort descending" : "Sort ascending"}
          >
            {filters.sortBy.endsWith('-asc') ? (
              <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowDown className="w-3 h-3" />
            )}
          </button>
          <div className="flex items-center gap-2 ml-auto">
            {hasSelection && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={clearSelection}
                title="Clear selection"
              >
                <X className="w-3 h-3 mr-1" />
                Clear {selectedIds.size}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleCopyRequests}
              disabled={copyCount === 0}
              title={hasSelection ? "Copy selected requests as JSON" : "Copy filtered requests as JSON"}
            >
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? "Copied!" : `Copy ${copyCount}`}
            </Button>
            <span className="text-xs text-muted-foreground">
              {hasSelection ? `${selectedIds.size} selected` : `${filteredRequests.length} / ${requests.length}`}
            </span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-hidden">
        {viewMode === "grouped" ? (
          <GroupedView
            groups={groups}
            selectedRequest={selectedRequest}
            onSelectRequest={onSelectRequest}
            jwtHeaders={jwtHeaders}
            selectedIds={selectedIds}
            toggleSelected={toggleSelected}
            markedIds={markedIds}
            toggleMarked={toggleMarked}
          />
        ) : (
          <FlatView
            requests={filteredRequests}
            selectedRequest={selectedRequest}
            onSelectRequest={onSelectRequest}
            jwtHeaders={jwtHeaders}
            selectedIds={selectedIds}
            toggleSelected={toggleSelected}
            markedIds={markedIds}
            toggleMarked={toggleMarked}
          />
        )}
      </ScrollArea>
    </div>
  );
}
