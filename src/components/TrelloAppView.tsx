import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JWTDecoder } from "@/components/JWTDecoder";
import { TrelloImageRow } from "@/components/TrelloImageRow";
import { useCardSearch } from "@/hooks/common/useCardSearch";
import { copyToClipboard } from "@/lib/clipboard";
import {
  buildCardExport,
  formatTrelloMarkdown,
  listLanesSorted,
  type FormatMarkdownOptions,
} from "@/lib/trello/aggregate";
import { fetchAllImagesAsDataUri, saveAllImagesToDisk } from "@/lib/trello/proxyImage";
import type { TrelloAggregateState, TrelloCardExport } from "@/types/trello";
import type { SavedImage, TrelloAuthInfo } from "@/types/trelloAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clipboard, FileJson, Key, Loader2, Moon, Monitor, Search, Settings, Sun, Trash2, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LANE_FILTER_ALL = "__lane_all__";
const COPY_CARD_LIMITS = [10, 20, 40, 60, 100] as const;
type CopyCardLimit = (typeof COPY_CARD_LIMITS)[number];

type CopyMode = "save-to-disk" | "embed-base64" | "plain-links";
const COPY_MODE_LABELS: Record<CopyMode, string> = {
  "save-to-disk": "Download images",
  "embed-base64": "Inline images (base64)",
  "plain-links": "Links only",
};

interface TrelloAppViewProps {
  trelloState: TrelloAggregateState;
  captureCount: number;
  inspectedPageUrl: string;
  trelloAuth: TrelloAuthInfo;
  onClearCapture: () => void;
  onOpenSettings: () => void;
}

export function TrelloAppView({
  trelloState,
  captureCount,
  inspectedPageUrl,
  trelloAuth,
  onClearCapture,
  onOpenSettings,
}: TrelloAppViewProps) {
  const { theme, setTheme } = useTheme();
  const [laneFilter, setLaneFilter] = useState<string>(LANE_FILTER_ALL);
  const laneOptions = useMemo(() => listLanesSorted(trelloState), [trelloState]);
  const activeLaneId = laneFilter === LANE_FILTER_ALL ? null : laneFilter;
  const { query: searchQuery, setQuery: setSearchQuery, filteredRows: rows } = useCardSearch(
    trelloState,
    activeLaneId
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [copyCardLimit, setCopyCardLimit] = useState<CopyCardLimit>(10);
  const [copyMode, setCopyMode] = useState<CopyMode>("save-to-disk");
  const [copyBusy, setCopyBusy] = useState(false);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const hasAuth = Boolean(trelloAuth.apiToken || trelloAuth.jwtToken);
  const [savedImagesMap, setSavedImagesMap] = useState<Map<string, SavedImage>>(new Map());

  useEffect(() => {
    if (laneFilter !== LANE_FILTER_ALL && !laneOptions.some((l) => l.id === laneFilter)) {
      setLaneFilter(LANE_FILTER_ALL);
    }
  }, [laneFilter, laneOptions]);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      const prefer = trelloState.activeCardId;
      if (prefer && rows.some((r) => r.id === prefer)) return prefer;
      return rows[0].id;
    });
  }, [rows, trelloState.activeCardId]);

  const selectedExport = useMemo(() => {
    if (!selectedId) return null;
    return buildCardExport(trelloState, selectedId);
  }, [trelloState, selectedId]);

  const jsonPayload = useMemo(() => {
    if (!selectedExport) return "";
    const payload: Record<string, unknown> = { ...selectedExport };
    if (trelloAuth.apiToken) payload._trelloApiToken = trelloAuth.apiToken;
    if (trelloAuth.apiKey) payload._trelloApiKey = trelloAuth.apiKey;
    if (trelloAuth.jwtToken) payload._trelloJwt = trelloAuth.jwtToken;
    return JSON.stringify(payload, null, 2);
  }, [selectedExport, trelloAuth]);

  const hint = useCallback((msg: string, duration = 3000) => {
    setCopyHint(msg);
    window.setTimeout(() => setCopyHint(null), duration);
  }, []);

  const runCopy = useCallback(async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    hint(ok ? `${label} copied` : "Copy failed");
  }, [hint]);

  const buildMarkdownForExport = useCallback(async (
    exp: TrelloCardExport,
    mode: CopyMode,
    onProgress?: (msg: string) => void
  ): Promise<string> => {
    const opts: FormatMarkdownOptions = { auth: trelloAuth };

    if (mode === "save-to-disk" && exp.imageUrls.length > 0) {
      const slug = exp.shortLink ?? exp.id.slice(0, 8);
      const saved = await saveAllImagesToDisk(exp.imageUrls, slug, savedImagesMap, (done, total) => {
        onProgress?.(`Saving images… ${done}/${total}`);
      });
      setSavedImagesMap((prev) => {
        const next = new Map(prev);
        for (const [k, v] of saved) next.set(k, v);
        return next;
      });
      opts.savedImages = saved;
    }

    if (mode === "embed-base64" && exp.imageUrls.length > 0) {
      const images = await fetchAllImagesAsDataUri(exp.imageUrls, (done, total) => {
        onProgress?.(`Fetching images… ${done}/${total}`);
      });
      opts.embeddedImages = images;
    }

    return formatTrelloMarkdown(exp, opts);
  }, [trelloAuth, savedImagesMap]);

  const handleCopy = useCallback(async () => {
    if (!selectedExport) return;
    setCopyBusy(true);
    try {
      const md = await buildMarkdownForExport(selectedExport, copyMode, setCopyHint);
      const ok = await copyToClipboard(md);
      hint(ok ? "Markdown copied" : "Copy failed");
    } catch {
      hint("Copy failed");
    } finally {
      setCopyBusy(false);
    }
  }, [selectedExport, copyMode, buildMarkdownForExport, hint]);

  const handleBulkCopy = useCallback(async () => {
    if (rows.length === 0) return;
    setCopyBusy(true);
    const n = Math.min(copyCardLimit, rows.length);
    try {
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        setCopyHint(`Card ${i + 1}/${n}…`);
        const exp = buildCardExport(trelloState, rows[i].id);
        const md = await buildMarkdownForExport(exp, copyMode, setCopyHint);
        parts.push(md);
      }
      const bulk = parts.join("\n\n---\n\n");
      const ok = await copyToClipboard(bulk);
      hint(ok ? `${n} card(s) copied` : "Copy failed");
    } catch {
      hint("Bulk copy failed");
    } finally {
      setCopyBusy(false);
    }
  }, [rows, trelloState, copyCardLimit, copyMode, buildMarkdownForExport, hint]);

  const handleImageSaved = useCallback((saved: SavedImage) => {
    setSavedImagesMap((prev) => {
      const next = new Map(prev);
      next.set(saved.originalUrl, saved);
      return next;
    });
  }, []);

  const onTrelloPage = useMemo(() => {
    try {
      const h = new URL(inspectedPageUrl).hostname.toLowerCase();
      return h === "trello.com" || h.endsWith(".trello.com");
    } catch {
      return false;
    }
  }, [inspectedPageUrl]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold truncate">Trello Agent Context</h1>
          <p className="text-[11px] text-muted-foreground truncate">
            {captureCount} Trello requests · {rows.length} card{rows.length === 1 ? "" : "s"}
            {!onTrelloPage ? " · inspect a Trello tab" : ""}
          </p>
          {copyHint ? <p className="text-[11px] text-muted-foreground truncate">{copyHint}</p> : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Select value={copyMode} onValueChange={(v) => setCopyMode(v as CopyMode)}>
            <SelectTrigger size="sm" className="h-7 text-[11px] w-[140px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="save-to-disk">{COPY_MODE_LABELS["save-to-disk"]}</SelectItem>
              <SelectItem value="embed-base64">{COPY_MODE_LABELS["embed-base64"]}</SelectItem>
              <SelectItem value="plain-links">{COPY_MODE_LABELS["plain-links"]}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClearCapture} title="Clear capture">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onOpenSettings} title="Storage limits">
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() =>
              setTheme(theme === "system" ? "light" : theme === "light" ? "dark" : "system")
            }
            title="Theme"
          >
            {theme === "system" ? <Monitor className="w-4 h-4" /> : theme === "light" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 divide-x divide-border">
        <div className="w-[min(100%,260px)] sm:w-[300px] flex flex-col min-h-0 shrink-0 bg-muted/20">
          <div className="px-2 py-1.5 space-y-1.5 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter cards…"
                className="h-7 text-xs pl-7 pr-7"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Select value={laneFilter} onValueChange={setLaneFilter}>
                <SelectTrigger size="sm" className="h-7 text-[11px] flex-1 min-w-0">
                  <SelectValue placeholder="All lanes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={LANE_FILTER_ALL}>All lanes</SelectItem>
                  {laneOptions.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(copyCardLimit)}
                onValueChange={(v) => setCopyCardLimit(Number(v) as CopyCardLimit)}
              >
                <SelectTrigger size="sm" className="h-7 text-[11px] w-[72px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COPY_CARD_LIMITS.map((lim) => (
                    <SelectItem key={lim} value={String(lim)}>
                      First {lim}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-[11px] px-2 shrink-0"
                disabled={rows.length === 0 || copyBusy}
                onClick={handleBulkCopy}
                title={`Copy ${Math.min(copyCardLimit, rows.length)} card(s) as ${COPY_MODE_LABELS[copyMode]}`}
              >
                {copyBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clipboard className="w-3 h-3" />}
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            {rows.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground space-y-2">
                {searchQuery ? (
                  <p>No cards match &ldquo;{searchQuery}&rdquo;. Try a different search term or clear the filter.</p>
                ) : (
                  <>
                    <p>No cards match this filter. On a board tab, Trello loads a bulk board request (visible cards + lists) automatically.</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Reload the board or switch lists to capture it</li>
                      <li>Open a card for full description and checklists</li>
                    </ul>
                  </>
                )}
              </div>
            ) : (
              <ul className="p-1">
                {rows.map((row) => {
                  const isActive = row.id === trelloState.activeCardId;
                  const title =
                    row.fields.name?.trim() ||
                    (row.fields.shortLink ? `/${row.fields.shortLink}` : null) ||
                    `${row.id.slice(0, 8)}…`;
                  const laneLabel =
                    row.fields.idList && trelloState.lanes[row.fields.idList]
                      ? trelloState.lanes[row.fields.idList].name
                      : null;
                  const selected = row.id === selectedId;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className={`w-full text-left rounded-md px-2 py-2 text-xs transition-colors ${
                          selected ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                        }`}
                      >
                        <div className="font-medium line-clamp-2">{title}</div>
                        {laneLabel ? (
                          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{laneLabel}</div>
                        ) : null}
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
                          {row.id}
                          {isActive ? " · last focused" : ""}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {!selectedId || !selectedExport ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
              Select a card from the list
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border shrink-0">
                <Button size="sm" variant="secondary" onClick={handleCopy} disabled={copyBusy}>
                  {copyBusy ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Clipboard className="w-3.5 h-3.5 mr-1" />
                  )}
                  Copy Markdown
                </Button>
                <Button size="sm" variant="secondary" onClick={() => runCopy(jsonPayload, "JSON")}>
                  <FileJson className="w-3.5 h-3.5 mr-1" />
                  Copy JSON
                </Button>
                {hasAuth && (
                  <Button
                    size="sm"
                    variant={showAuthPanel ? "default" : "outline"}
                    onClick={() => setShowAuthPanel((v) => !v)}
                  >
                    <Key className="w-3.5 h-3.5 mr-1" />
                    Auth
                  </Button>
                )}
              </div>
              {showAuthPanel && hasAuth && (
                <div className="px-3 py-2 border-b border-border bg-muted/30 space-y-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Trello Auth</div>
                    <button
                      type="button"
                      onClick={() => setShowAuthPanel(false)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {trelloAuth.apiKey && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground shrink-0">API key:</span>
                      <code className="text-[11px] font-mono truncate flex-1 min-w-0">{trelloAuth.apiKey}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={() => runCopy(trelloAuth.apiKey!, "API key")}
                      >
                        <Clipboard className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  {trelloAuth.apiToken && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground shrink-0">API token:</span>
                      <code className="text-[11px] font-mono truncate flex-1 min-w-0">{trelloAuth.apiToken}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={() => runCopy(trelloAuth.apiToken!, "API token")}
                      >
                        <Clipboard className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  {trelloAuth.jwtToken && trelloAuth.jwtHeaderName && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground shrink-0">JWT ({trelloAuth.jwtHeaderName}):</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[11px] shrink-0"
                          onClick={() => runCopy(trelloAuth.jwtToken!, "JWT")}
                        >
                          <Clipboard className="w-3 h-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <div className="max-h-48 overflow-auto rounded-md border border-border bg-background p-2">
                        <JWTDecoder token={trelloAuth.jwtToken} headerName={trelloAuth.jwtHeaderName} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3 space-y-3 text-sm max-w-3xl">
                  {selectedExport.name ? (
                    <div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Title</div>
                      <div className="font-semibold">{selectedExport.name}</div>
                    </div>
                  ) : null}
                  {selectedExport.laneName ? (
                    <div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Lane</div>
                      <div className="text-sm">{selectedExport.laneName}</div>
                    </div>
                  ) : null}
                  {selectedExport.shortUrl || selectedExport.url ? (
                    <div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Link</div>
                      <a
                        href={selectedExport.shortUrl ?? selectedExport.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline break-all"
                      >
                        {selectedExport.shortUrl ?? selectedExport.url}
                      </a>
                    </div>
                  ) : selectedExport.shortLink ? (
                    <div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Link</div>
                      <a
                        href={`https://trello.com/c/${selectedExport.shortLink}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline"
                      >
                        trello.com/c/{selectedExport.shortLink}
                      </a>
                    </div>
                  ) : null}
                  {selectedExport.desc ? (
                    <div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Description</div>
                      <pre className="whitespace-pre-wrap text-xs bg-muted/40 rounded-md p-2 max-h-48 overflow-auto border border-border">
                        {selectedExport.desc}
                      </pre>
                    </div>
                  ) : null}
                  <div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Checklists</div>
                    {!selectedExport.checklists.length ? (
                      <p className="text-xs text-muted-foreground">None captured for this card yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedExport.checklists.map((cl) => (
                          <li key={cl.id}>
                            <div className="text-xs font-medium">{cl.name}</div>
                            <ul className="ml-2 mt-1 space-y-0.5">
                              {(cl.checkItems ?? []).map((it) => (
                                <li key={it.id} className="text-xs">
                                  {it.state === "complete" ? "☑ " : "☐ "}
                                  {it.name}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {selectedExport.attachmentUrls.length > 0 && (
                    <div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Attachments</div>
                      <ul className="text-xs space-y-1 break-all">
                        {selectedExport.attachmentUrls.map((a, i) => (
                          <li key={`a-${i}`}>
                            <a className="text-primary underline" href={a.url} target="_blank" rel="noreferrer">
                              {a.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">
                      Images{selectedExport.imageUrls.length > 0 && (
                        <span className="normal-case ml-1 font-normal">
                          — click copy to paste as image into agent
                        </span>
                      )}
                    </div>
                    {!selectedExport.imageUrls.length ? (
                      <p className="text-xs text-muted-foreground">None detected in payload.</p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedExport.imageUrls.map((u) => (
                          <TrelloImageRow
                            key={u}
                            url={u}
                            cardSlug={selectedExport.shortLink ?? selectedExport.id.slice(0, 8)}
                            onHint={(msg) => hint(msg)}
                            onSaved={handleImageSaved}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
