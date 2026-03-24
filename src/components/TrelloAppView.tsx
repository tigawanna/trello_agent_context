import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { copyToClipboard } from "@/lib/clipboard";
import {
  buildCardExport,
  formatTrelloMarkdown,
  listDetectedCards,
  listLanesSorted,
} from "@/lib/trello/aggregate";
import type { TrelloAggregateState } from "@/types/trello";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clipboard, FileJson, Moon, Monitor, Settings, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";

const LANE_FILTER_ALL = "__lane_all__";
const COPY_CARD_LIMITS = [10, 20, 40, 60, 100] as const;
type CopyCardLimit = (typeof COPY_CARD_LIMITS)[number];

interface TrelloAppViewProps {
  trelloState: TrelloAggregateState;
  captureCount: number;
  inspectedPageUrl: string;
  onClearCapture: () => void;
  onOpenSettings: () => void;
}

export function TrelloAppView({
  trelloState,
  captureCount,
  inspectedPageUrl,
  onClearCapture,
  onOpenSettings,
}: TrelloAppViewProps) {
  const { theme, setTheme } = useTheme();
  const [laneFilter, setLaneFilter] = useState<string>(LANE_FILTER_ALL);
  const laneOptions = useMemo(() => listLanesSorted(trelloState), [trelloState]);
  const rows = useMemo(
    () => listDetectedCards(trelloState, laneFilter === LANE_FILTER_ALL ? null : laneFilter),
    [trelloState, laneFilter]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [copyCardLimit, setCopyCardLimit] = useState<CopyCardLimit>(10);

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

  const markdown = useMemo(
    () => (selectedExport ? formatTrelloMarkdown(selectedExport) : ""),
    [selectedExport]
  );
  const jsonPayload = useMemo(
    () => (selectedExport ? JSON.stringify(selectedExport, null, 2) : ""),
    [selectedExport]
  );

  const bulkMarkdown = useMemo(() => {
    if (rows.length === 0) return "";
    const n = Math.min(copyCardLimit, rows.length);
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const exp = buildCardExport(trelloState, rows[i].id);
      parts.push(formatTrelloMarkdown(exp));
    }
    return parts.join("\n\n---\n\n");
  }, [rows, trelloState, copyCardLimit]);

  const runCopy = useCallback(async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    setCopyHint(ok ? `${label} copied` : "Copy failed");
    window.setTimeout(() => setCopyHint(null), 2000);
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
        <div className="flex items-center gap-0.5 shrink-0">
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
          <div className="px-2 py-2 space-y-2 border-b border-border">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Lane</div>
            <Select value={laneFilter} onValueChange={setLaneFilter}>
              <SelectTrigger size="sm" className="w-full h-8 text-xs">
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
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Cards</div>
            <div className="flex flex-col gap-2">
              <div className="text-[10px] text-muted-foreground">Copy up to (list order)</div>
              <Select
                value={String(copyCardLimit)}
                onValueChange={(v) => setCopyCardLimit(Number(v) as CopyCardLimit)}
              >
                <SelectTrigger size="sm" className="w-full h-8 text-xs">
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
                className="h-8 text-xs w-full"
                disabled={!bulkMarkdown}
                onClick={() => runCopy(bulkMarkdown, "All cards (Markdown)")}
              >
                <Clipboard className="w-3.5 h-3.5 shrink-0 mr-1" />
                Copy all
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            {rows.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground space-y-2">
                <p>No cards match this filter. On a board tab, Trello loads a bulk board request (visible cards + lists) automatically.</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Reload the board or switch lists to capture it</li>
                  <li>Open a card for full description and checklists</li>
                </ul>
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
                <Button size="sm" variant="secondary" onClick={() => runCopy(markdown, "Markdown")}>
                  <Clipboard className="w-3.5 h-3.5 mr-1" />
                  Copy Markdown
                </Button>
                <Button size="sm" variant="secondary" onClick={() => runCopy(jsonPayload, "JSON")}>
                  <FileJson className="w-3.5 h-3.5 mr-1" />
                  Copy JSON
                </Button>
              </div>
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
                  <div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Attachments & images</div>
                    {!selectedExport.attachmentUrls.length && !selectedExport.imageUrls.length ? (
                      <p className="text-xs text-muted-foreground">None in payload.</p>
                    ) : (
                      <ul className="text-xs space-y-1 break-all">
                        {selectedExport.attachmentUrls.map((a, i) => (
                          <li key={`a-${i}`}>
                            <a className="text-primary underline" href={a.url} target="_blank" rel="noreferrer">
                              {a.name}
                            </a>
                          </li>
                        ))}
                        {selectedExport.imageUrls.map((u) => (
                          <li key={u}>
                            <a className="text-primary underline" href={u} target="_blank" rel="noreferrer">
                              {u}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Markdown preview</div>
                    <pre className="whitespace-pre-wrap text-[11px] bg-muted/20 rounded-md p-2 max-h-56 overflow-auto border border-border">
                      {markdown}
                    </pre>
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
