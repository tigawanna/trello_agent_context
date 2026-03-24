import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copyToClipboard } from "@/lib/clipboard";
import { Check, Copy, ExternalLink, Link2, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface URLParts {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
}

interface QueryParam {
  key: string;
  value: string;
  id: string;
}

interface URLInspectorProps {
  currentPageUrl: string;
}

function parseUrlParts(url: string): URLParts {
  try {
    const urlObj = new URL(url);
    return {
      protocol: urlObj.protocol.replace(":", ""),
      hostname: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash,
    };
  } catch {
    return {
      protocol: "https",
      hostname: "",
      port: "",
      pathname: "/",
      search: "",
      hash: "",
    };
  }
}

function parseQueryParams(search: string): QueryParam[] {
  if (!search || search === "?") return [];
  const params = new URLSearchParams(search);
  const result: QueryParam[] = [];
  params.forEach((value, key) => {
    result.push({ key, value, id: crypto.randomUUID() });
  });
  return result;
}

function buildUrl(parts: URLParts, queryParams: QueryParam[]): string {
  const searchParams = new URLSearchParams();
  queryParams.forEach((param) => {
    if (param.key) {
      searchParams.append(param.key, param.value);
    }
  });
  
  const search = searchParams.toString();
  const port = parts.port ? `:${parts.port}` : "";
  const hash = parts.hash.startsWith("#") ? parts.hash : parts.hash ? `#${parts.hash}` : "";
  const queryString = search ? `?${search}` : "";
  
  return `${parts.protocol}://${parts.hostname}${port}${parts.pathname}${queryString}${hash}`;
}

export function URLInspector({ currentPageUrl }: URLInspectorProps) {
  const [urlParts, setUrlParts] = useState<URLParts>(() => parseUrlParts(currentPageUrl));
  const [queryParams, setQueryParams] = useState<QueryParam[]>(() => 
    parseQueryParams(parseUrlParts(currentPageUrl).search)
  );
  const [activeTab, setActiveTab] = useState("overview");
  
  // Visual feedback states
  const [copied, setCopied] = useState(false);
  const [synced, setSynced] = useState(false);
  const [navigated, setNavigated] = useState(false);
  const [paramCopiedId, setParamCopiedId] = useState<string | null>(null);
  const [urlPartCopied, setUrlPartCopied] = useState<string | null>(null);

  // Update when currentPageUrl changes
  useEffect(() => {
    const parts = parseUrlParts(currentPageUrl);
    setUrlParts(parts);
    setQueryParams(parseQueryParams(parts.search));
  }, [currentPageUrl]);

  const constructedUrl = useMemo(() => buildUrl(urlParts, queryParams), [urlParts, queryParams]);
  
  const hasChanges = useMemo(() => constructedUrl !== currentPageUrl, [constructedUrl, currentPageUrl]);

  const handlePartChange = (part: keyof URLParts, value: string) => {
    setUrlParts((prev) => ({ ...prev, [part]: value }));
  };

  const handleParamChange = (id: string, field: "key" | "value", value: string) => {
    setQueryParams((prev) =>
      prev.map((param) => (param.id === id ? { ...param, [field]: value } : param))
    );
  };

  const addQueryParam = () => {
    setQueryParams((prev) => [...prev, { key: "", value: "", id: crypto.randomUUID() }]);
  };

  const removeQueryParam = (id: string) => {
    setQueryParams((prev) => prev.filter((param) => param.id !== id));
  };

  const resetToOriginal = () => {
    const parts = parseUrlParts(currentPageUrl);
    setUrlParts(parts);
    setQueryParams(parseQueryParams(parts.search));
  };

  const syncWithCurrentUrl = () => {
    // Try to get the current URL from the devtools inspected window
    if (typeof chrome !== "undefined" && chrome.devtools?.inspectedWindow) {
      chrome.devtools.inspectedWindow.eval(
        "window.location.href",
        (result: string) => {
          if (result && typeof result === "string") {
            const parts = parseUrlParts(result);
            setUrlParts(parts);
            setQueryParams(parseQueryParams(parts.search));
            setSynced(true);
            setTimeout(() => setSynced(false), 2000);
          }
        }
      );
    } else {
      // Fallback to using currentPageUrl
      resetToOriginal();
      setSynced(true);
      setTimeout(() => setSynced(false), 2000);
    }
  };

  const navigateToUrl = () => {
    // Use chrome.devtools.inspectedWindow.eval to navigate the inspected page
    if (typeof chrome !== "undefined" && chrome.devtools?.inspectedWindow) {
      chrome.devtools.inspectedWindow.eval(`window.location.href = ${JSON.stringify(constructedUrl)}`);
    } else {
      // Fallback for development/testing
      window.open(constructedUrl, "_blank");
    }
    setNavigated(true);
    setTimeout(() => setNavigated(false), 2000);
  };

  const copyUrlPart = async (value: string, partName: string) => {
    const success = await copyToClipboard(value);
    if (success) {
      setUrlPartCopied(partName);
      setTimeout(() => setUrlPartCopied(null), 2000);
    }
  };

  const copyQueryParam = async (key: string, value: string, id: string) => {
    const success = await copyToClipboard(`${key}=${value}`);
    if (success) {
      setParamCopiedId(id);
      setTimeout(() => setParamCopiedId(null), 2000);
    }
  };

  const copyUrl = async () => {
    const success = await copyToClipboard(constructedUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const origin = `${urlParts.protocol}://${urlParts.hostname}${urlParts.port ? `:${urlParts.port}` : ""}`;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Current URL Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Current Page URL
            </h3>
            <div className="flex items-center gap-1">
              {hasChanges && (
                <Badge variant="secondary" className="text-xs">
                  Modified
                </Badge>
              )}
            </div>
          </div>
          
          <div className="p-3 bg-muted rounded-md font-mono text-xs break-all">
            {currentPageUrl || "No URL available"}
          </div>

          {hasChanges && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Modified URL:</div>
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md font-mono text-xs break-all">
                {constructedUrl}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyUrl}
              className="flex-1"
            >
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? "Copied!" : "Copy URL"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={syncWithCurrentUrl}
              title="Sync with current page URL"
            >
              {synced ? <Check className="w-3 h-3 mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
              {synced ? "Synced!" : "Sync"}
            </Button>
            {hasChanges && (
              <Button
                variant="default"
                size="sm"
                onClick={navigateToUrl}
              >
                {navigated ? <Check className="w-3 h-3 mr-1" /> : <ExternalLink className="w-3 h-3 mr-1" />}
                {navigated ? "Navigated!" : "Navigate"}
              </Button>
            )}
          </div>
        </div>

        {/* URL Parts Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="params">
              Params
              {queryParams.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {queryParams.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-3">
            <URLPartRow label="Protocol" value={urlParts.protocol} copyable urlPartCopied={urlPartCopied} onCopy={copyUrlPart} />
            <URLPartRow label="Hostname" value={urlParts.hostname} copyable urlPartCopied={urlPartCopied} onCopy={copyUrlPart} />
            {urlParts.port && <URLPartRow label="Port" value={urlParts.port} copyable urlPartCopied={urlPartCopied} onCopy={copyUrlPart} />}
            <URLPartRow label="Origin" value={origin} copyable urlPartCopied={urlPartCopied} onCopy={copyUrlPart} />
            <URLPartRow label="Pathname" value={urlParts.pathname} copyable urlPartCopied={urlPartCopied} onCopy={copyUrlPart} />
            {queryParams.length > 0 && (
              <URLPartRow 
                label="Search" 
                value={`${queryParams.length} parameter${queryParams.length !== 1 ? "s" : ""}`} 
              />
            )}
            {urlParts.hash && <URLPartRow label="Hash" value={urlParts.hash} copyable urlPartCopied={urlPartCopied} onCopy={copyUrlPart} />}
          </TabsContent>

          {/* Query Params Tab */}
          <TabsContent value="params" className="mt-4 space-y-3">
            {queryParams.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No query parameters
              </div>
            ) : (
              <div className="space-y-2">
                {queryParams.map((param) => (
                  <div
                    key={param.id}
                    className="p-3 bg-muted rounded-md flex items-center gap-3"
                  >
                    <div className="flex-1 grid grid-cols-[auto_1fr] gap-3 items-center min-w-0">
                      <span className="text-xs font-medium text-muted-foreground shrink-0">
                        {param.key || "(empty key)"}:
                      </span>
                      <div className="font-mono text-sm break-all">
                        {decodeURIComponent(param.value) || "(empty value)"}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={() => copyQueryParam(param.key, param.value, param.id)}
                      title="Copy parameter"
                    >
                      {paramCopiedId === param.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={addQueryParam}
              className="w-full"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Parameter
            </Button>
          </TabsContent>

          {/* Edit Tab */}
          <TabsContent value="edit" className="mt-4 space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">URL Components</h4>
              
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Protocol</label>
                <select
                  value={urlParts.protocol}
                  onChange={(e) => handlePartChange("protocol", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                >
                  <option value="https">https</option>
                  <option value="http">http</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Hostname</label>
                <Input
                  value={urlParts.hostname}
                  onChange={(e) => handlePartChange("hostname", e.target.value)}
                  placeholder="example.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Port (optional)</label>
                <Input
                  value={urlParts.port}
                  onChange={(e) => handlePartChange("port", e.target.value)}
                  placeholder="3000"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Pathname</label>
                <Input
                  value={urlParts.pathname}
                  onChange={(e) => handlePartChange("pathname", e.target.value)}
                  placeholder="/path/to/page"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Hash (optional)</label>
                <Input
                  value={urlParts.hash.replace(/^#/, "")}
                  onChange={(e) => handlePartChange("hash", e.target.value)}
                  placeholder="section-id"
                />
              </div>
            </div>

            {/* Editable Query Params */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Query Parameters</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addQueryParam}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>

              {queryParams.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-xs border border-dashed border-border rounded-md">
                  No query parameters. Click "Add" to create one.
                </div>
              ) : (
                <div className="space-y-2">
                  {queryParams.map((param, index) => (
                    <div
                      key={param.id}
                      className="flex items-center gap-2 p-2 bg-muted rounded-md"
                    >
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={param.key}
                          onChange={(e) => handleParamChange(param.id, "key", e.target.value)}
                          placeholder="key"
                          className="h-8 text-xs w-fit min-w-20 max-w-32"
                        />
                        <span className="text-xs text-muted-foreground">=</span>
                        <Input
                          value={param.value}
                          onChange={(e) => handleParamChange(param.id, "value", e.target.value)}
                          placeholder="value"
                          className="h-8 text-xs flex-1"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeQueryParam(param.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}

interface URLPartRowProps {
  label: string;
  value: string;
  copyable?: boolean;
  urlPartCopied?: string | null;
  onCopy?: (value: string, label: string) => void;
}

function URLPartRow({ label, value, copyable, urlPartCopied, onCopy }: URLPartRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-b-0">
      <span className="text-xs text-muted-foreground shrink-0 w-20">{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="font-mono text-sm break-all flex-1">{value}</span>
        {copyable && value && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={() => onCopy?.(value, label)}
            title={`Copy ${label.toLowerCase()}`}
          >
            {urlPartCopied === label ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </Button>
        )}
      </div>
    </div>
  );
}
