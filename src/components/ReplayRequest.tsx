import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Play, X, Plus, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { CapturedRequest } from "@/types/request";

interface ReplayResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
}

interface ExecuteRequestParams {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

class ReplayError extends Error {
  details: string;
  suggestions: string[];
  
  constructor(message: string, details: string, suggestions: string[] = []) {
    super(message);
    this.name = "ReplayError";
    this.details = details;
    this.suggestions = suggestions;
  }
}

// Response type from background script
interface ProxyFetchResponse {
  success: true;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
}

interface ProxyFetchError {
  success: false;
  error: string;
  details: string;
}

type ProxyFetchResult = ProxyFetchResponse | ProxyFetchError;

async function executeHttpRequest({ url, method, headers, body }: ExecuteRequestParams): Promise<ReplayResponse> {
  // Send request to background script for cross-origin support
  const response = await chrome.runtime.sendMessage<
    { type: string; url: string; method: string; headers: Record<string, string>; body?: string },
    ProxyFetchResult
  >({
    type: "PROXY_FETCH",
    url,
    method,
    headers,
    body,
  });

  if (!response) {
    throw new ReplayError(
      "No response from background script",
      "The background script did not respond. This could happen if the extension was just installed.",
      ["Try reloading the extension", "Close and reopen DevTools"]
    );
  }

  if (!response.success) {
    throw new ReplayError(
      response.error,
      response.details,
      [
        "CORS: The server may not allow cross-origin requests",
        "Network: The server may be unreachable or URL is invalid",
        "Auth: Request may require authentication cookies",
      ]
    );
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    body: response.body,
    duration: response.duration,
  };
}

interface ReplayRequestProps {
  request: CapturedRequest;
  onClose: () => void;
}

interface HeaderEntry {
  key: string;
  value: string;
  enabled: boolean;
}

interface ParamEntry {
  key: string;
  value: string;
  enabled: boolean;
}

function parseUrlParams(url: string): ParamEntry[] {
  try {
    const urlObj = new URL(url);
    const params: ParamEntry[] = [];
    urlObj.searchParams.forEach((value, key) => {
      params.push({ key, value, enabled: true });
    });
    return params;
  } catch {
    return [];
  }
}

function buildUrl(baseUrl: string, params: ParamEntry[]): string {
  try {
    const urlObj = new URL(baseUrl.split("?")[0]);
    params.forEach((param) => {
      if (param.enabled && param.key) {
        urlObj.searchParams.append(param.key, param.value);
      }
    });
    return urlObj.toString();
  } catch {
    return baseUrl;
  }
}

function parseHeaders(headers: Record<string, string>): HeaderEntry[] {
  return Object.entries(headers).map(([key, value]) => ({
    key,
    value,
    enabled: true,
  }));
}

function buildHeaders(entries: HeaderEntry[]): Record<string, string> {
  const headers: Record<string, string> = {};
  entries.forEach((entry) => {
    if (entry.enabled && entry.key) {
      headers[entry.key] = entry.value;
    }
  });
  return headers;
}

export function ReplayRequest({ request, onClose }: ReplayRequestProps) {
  const [method, setMethod] = useState(request.method);
  const [params, setParams] = useState<ParamEntry[]>(() => parseUrlParams(request.url));
  const [headers, setHeaders] = useState<HeaderEntry[]>(() => parseHeaders(request.requestHeaders));
  const [body, setBody] = useState(request.requestBody || "");

  const baseUrl = request.url.split("?")[0];

  const mutation = useMutation({
    mutationFn: executeHttpRequest,
  });

  const addParam = () => {
    setParams([...params, { key: "", value: "", enabled: true }]);
  };

  const removeParam = (index: number) => {
    setParams(params.filter((_, i) => i !== index));
  };

  const updateParam = (index: number, field: keyof ParamEntry, value: string | boolean) => {
    setParams(params.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const addHeader = () => {
    setHeaders([...headers, { key: "", value: "", enabled: true }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: keyof HeaderEntry, value: string | boolean) => {
    setHeaders(headers.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
  };

  const resetToOriginal = () => {
    setMethod(request.method);
    setParams(parseUrlParams(request.url));
    setHeaders(parseHeaders(request.requestHeaders));
    setBody(request.requestBody || "");
    mutation.reset();
  };

  const handleExecute = () => {
    mutation.mutate({
      url: buildUrl(baseUrl, params),
      method,
      headers: buildHeaders(headers),
      body: method !== "GET" && method !== "HEAD" ? body : undefined,
    });
  };

  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-sm font-semibold">Replay Request</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={resetToOriginal} title="Reset to original">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="px-2 py-1 text-xs font-mono bg-secondary border border-border rounded"
        >
          {methods.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="text"
          value={buildUrl(baseUrl, params)}
          readOnly
          className="flex-1 px-2 py-1 text-xs font-mono bg-muted border border-border rounded truncate"
        />
        <Button size="sm" onClick={handleExecute} disabled={mutation.isPending}>
          <Play className="w-4 h-4 mr-1" />
          {mutation.isPending ? "Sending..." : "Send"}
        </Button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs defaultValue="params" className="flex-1 flex flex-col">
          <TabsList className="mx-3 mt-2 w-fit">
            <TabsTrigger value="params">Params ({params.length})</TabsTrigger>
            <TabsTrigger value="headers">Headers ({headers.length})</TabsTrigger>
            <TabsTrigger value="body">Body</TabsTrigger>
            {mutation.data && <TabsTrigger value="response">Response</TabsTrigger>}
          </TabsList>

          <TabsContent value="params" className="flex-1 overflow-hidden mt-0 p-3">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {params.map((param, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={param.enabled}
                      onChange={(e) => updateParam(index, "enabled", e.target.checked)}
                      className="w-4 h-4"
                    />
                    <input
                      type="text"
                      value={param.key}
                      onChange={(e) => updateParam(index, "key", e.target.value)}
                      placeholder="Key"
                      className="flex-1 px-2 py-1 text-xs font-mono bg-background border border-border rounded"
                    />
                    <input
                      type="text"
                      value={param.value}
                      onChange={(e) => updateParam(index, "value", e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-2 py-1 text-xs font-mono bg-background border border-border rounded"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeParam(index)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addParam}>
                  <Plus className="w-3 h-3 mr-1" /> Add Param
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="headers" className="flex-1 overflow-hidden mt-0 p-3">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {headers.map((header, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={header.enabled}
                      onChange={(e) => updateHeader(index, "enabled", e.target.checked)}
                      className="w-4 h-4"
                    />
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => updateHeader(index, "key", e.target.value)}
                      placeholder="Header name"
                      className="flex-1 px-2 py-1 text-xs font-mono bg-background border border-border rounded"
                    />
                    <input
                      type="text"
                      value={header.value}
                      onChange={(e) => updateHeader(index, "value", e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-2 py-1 text-xs font-mono bg-background border border-border rounded"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeHeader(index)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addHeader}>
                  <Plus className="w-3 h-3 mr-1" /> Add Header
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="body" className="flex-1 overflow-hidden mt-0 p-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Request body (JSON, form data, etc.)"
              className="w-full h-full px-2 py-2 text-xs font-mono bg-background border border-border rounded resize-none"
            />
          </TabsContent>

          {mutation.data && (
            <TabsContent value="response" className="flex-1 overflow-hidden mt-0 p-3">
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-2 py-1 text-xs font-mono rounded",
                        mutation.data.status >= 200 && mutation.data.status < 300 && "bg-green-500/20 text-green-500",
                        mutation.data.status >= 300 && mutation.data.status < 400 && "bg-blue-500/20 text-blue-500",
                        mutation.data.status >= 400 && mutation.data.status < 500 && "bg-yellow-500/20 text-yellow-500",
                        mutation.data.status >= 500 && "bg-red-500/20 text-red-500"
                      )}
                    >
                      {mutation.data.status} {mutation.data.statusText}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(mutation.data.duration)}ms
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold mb-1">Response Headers</h4>
                    <div className="text-xs font-mono bg-muted p-2 rounded max-h-32 overflow-auto">
                      {Object.entries(mutation.data.headers).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-muted-foreground">{key}:</span> {value}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold mb-1">Response Body</h4>
                    <pre className="text-xs font-mono bg-muted p-2 rounded overflow-auto max-h-64 whitespace-pre-wrap">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(mutation.data.body), null, 2);
                        } catch {
                          return mutation.data.body;
                        }
                      })()}
                    </pre>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>

        {mutation.error && (
          <div className="mx-3 mb-3 p-3 text-xs bg-red-500/10 rounded border border-red-500/20 space-y-2">
            <div className="font-semibold text-red-500">
              ❌ {mutation.error instanceof Error ? mutation.error.message : "Request failed"}
            </div>
            {mutation.error instanceof ReplayError && (
              <>
                <pre className="text-red-400 whitespace-pre-wrap font-mono text-[10px] bg-red-500/5 p-2 rounded">
                  {mutation.error.details}
                </pre>
                {mutation.error.suggestions.length > 0 && (
                  <div className="text-muted-foreground">
                    <div className="font-semibold mb-1">Possible causes:</div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {mutation.error.suggestions.map((suggestion, i) => (
                        <li key={i}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
