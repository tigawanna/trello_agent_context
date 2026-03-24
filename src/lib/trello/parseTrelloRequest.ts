import type { CapturedRequest } from "@/types/request";
import type {
  TrelloAttachment,
  TrelloCaptureEvent,
  TrelloCardFields,
  TrelloCheckItem,
  TrelloChecklist,
  TrelloLane,
} from "@/types/trello";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") out.push(item);
  }
  return out.length ? out : undefined;
}

function parseCheckItems(raw: unknown): TrelloCheckItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TrelloCheckItem[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = asString(item.id);
    const name = asString(item.name);
    const state = asString(item.state) ?? "incomplete";
    if (id && name) out.push({ id, name, state });
  }
  return out.length ? out : undefined;
}

function parseChecklistPayload(body: Record<string, unknown>): TrelloChecklist | null {
  const id = asString(body.id);
  const name = asString(body.name);
  if (!id || !name) return null;
  const checkItems = parseCheckItems(body.checkItems);
  return { id, name, checkItems };
}

function parseAttachments(raw: unknown): TrelloAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TrelloAttachment[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = asString(item.id);
    const name = asString(item.name);
    const url = asString(item.url);
    const mimeType = asString(item.mimeType);
    let previews: TrelloAttachment["previews"];
    if (Array.isArray(item.previews)) {
      previews = [];
      for (const p of item.previews) {
        if (!isRecord(p)) continue;
        const u = asString(p.url);
        const w = typeof p.width === "number" ? p.width : undefined;
        const h = typeof p.height === "number" ? p.height : undefined;
        if (u) previews.push({ url: u, width: w, height: h });
      }
    }
    out.push({ id, name, url, mimeType, previews });
  }
  return out.length ? out : undefined;
}

function parseCardPayload(body: Record<string, unknown>): TrelloCardFields | null {
  const id = asString(body.id);
  if (!id) return null;
  return {
    id,
    shortLink: asString(body.shortLink),
    name: asString(body.name),
    desc: asString(body.desc),
    url: asString(body.url),
    shortUrl: asString(body.shortUrl),
    idList: asString(body.idList),
    idChecklists: asStringArray(body.idChecklists),
    attachments: parseAttachments(body.attachments),
  };
}

function listPos(raw: Record<string, unknown>): number {
  const p = raw.pos;
  if (typeof p === "number" && Number.isFinite(p)) return p;
  if (typeof p === "string") {
    const n = Number(p);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseLanesFromListArray(listsRaw: unknown[]): TrelloLane[] {
  const lanes: TrelloLane[] = [];
  for (const item of listsRaw) {
    if (!isRecord(item)) continue;
    const id = asString(item.id);
    const name = asString(item.name);
    if (id && name) lanes.push({ id, name, pos: listPos(item) });
  }
  return lanes;
}

function parseCardsFromArray(cardsRaw: unknown[]): TrelloCardFields[] {
  const cards: TrelloCardFields[] = [];
  for (const item of cardsRaw) {
    if (!isRecord(item)) continue;
    const c = parseCardPayload(item);
    if (c) cards.push(c);
  }
  return cards;
}

function tryParseFlatBoardShape(rec: Record<string, unknown>): { lanes: TrelloLane[]; cards: TrelloCardFields[] } | null {
  const listsRaw = rec.lists;
  const cardsRaw = rec.cards;
  if (!Array.isArray(listsRaw) || !Array.isArray(cardsRaw)) return null;
  if (cardsRaw.length === 0) return null;
  const lanes = parseLanesFromListArray(listsRaw);
  const cards = parseCardsFromArray(cardsRaw);
  return cards.length ? { lanes, cards } : null;
}

function deepFindBoardShape(
  root: unknown,
  depth: number,
  maxDepth: number,
  seen: WeakSet<object>
): { lanes: TrelloLane[]; cards: TrelloCardFields[] } | null {
  if (depth > maxDepth || root === null || typeof root !== "object") return null;
  if (seen.has(root as object)) return null;
  seen.add(root as object);
  if (Array.isArray(root)) {
    for (const el of root) {
      const r = deepFindBoardShape(el, depth + 1, maxDepth, seen);
      if (r) return r;
    }
    return null;
  }
  const rec = root as Record<string, unknown>;
  const flat = tryParseFlatBoardShape(rec);
  if (flat) return flat;
  for (const v of Object.values(rec)) {
    const r = deepFindBoardShape(v, depth + 1, maxDepth, seen);
    if (r) return r;
  }
  return null;
}

function tryParseNestedListsWithCards(rec: Record<string, unknown>): { lanes: TrelloLane[]; cards: TrelloCardFields[] } | null {
  const listsRaw = rec.lists;
  if (!Array.isArray(listsRaw)) return null;
  const lanes: TrelloLane[] = [];
  const cards: TrelloCardFields[] = [];
  for (const item of listsRaw) {
    if (!isRecord(item)) continue;
    const lid = asString(item.id);
    const lname = asString(item.name);
    if (lid && lname) lanes.push({ id: lid, name: lname, pos: listPos(item) });
    const nested = item.cards;
    let cardArr: unknown[] | null = null;
    if (Array.isArray(nested)) cardArr = nested;
    else if (isRecord(nested) && Array.isArray(nested.edges)) {
      const edges = nested.edges as unknown[];
      cardArr = [];
      for (const e of edges) {
        if (isRecord(e) && e.node) cardArr.push(e.node);
      }
    }
    if (cardArr && lid) {
      for (const cRaw of cardArr) {
        if (!isRecord(cRaw)) continue;
        const base = parseCardPayload(cRaw);
        if (base) cards.push({ ...base, idList: base.idList ?? lid });
      }
    }
  }
  return cards.length ? { lanes, cards } : null;
}

function parseBoardBulkPayload(body: unknown): { lanes: TrelloLane[]; cards: TrelloCardFields[] } | null {
  if (!isRecord(body)) return null;
  const flat = tryParseFlatBoardShape(body);
  if (flat) return flat;
  const nested = tryParseNestedListsWithCards(body);
  if (nested) return nested;
  const data = body.data;
  if (data !== undefined) {
    const seen = new WeakSet<object>();
    const fromData = deepFindBoardShape(data, 0, 14, seen);
    if (fromData) return fromData;
    const dataRec = isRecord(data) ? tryParseNestedListsWithCards(data) : null;
    if (dataRec) return dataRec;
  }
  return deepFindBoardShape(body, 0, 10, new WeakSet<object>());
}

const BOARD_PATH = /^\/1\/boards?\/([^/?#]+)/i;

function isCurrentBoardListsCardsRequest(url: URL): boolean {
  const op = url.searchParams.get("operationName") ?? "";
  if (op === "quickload:CurrentBoardListsCards") return true;
  return url.searchParams.get("cards") === "visible" && url.searchParams.get("lists") === "open";
}

function isGraphqlBoardCardsOperation(url: URL): boolean {
  const op = url.searchParams.get("operationName") ?? "";
  return op === "quickload:TrelloCurrentBoardListsCards";
}

function tryParseJson(text: string | null): unknown {
  if (!text || text.trim() === "") return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

const MARK_VIEWED_PATH = /^\/1\/cards\/([a-f0-9]{24})\/markAsViewed$/i;
const CHECKLIST_PATH = /^\/1\/checklist\/([a-f0-9]{24})/i;
const CARD_PRELOAD_PATH = /^\/1\/card\/([^/?#]+)/i;
const CARDS_API_CHECKLISTS = /^https:\/\/api\.trello\.com\/1\/cards\/([a-f0-9]{24})\/checklists/i;

function isPreloadCardUrl(url: URL): boolean {
  const op = url.searchParams.get("operationName") ?? "";
  return op === "quickload:PreloadCard" || url.search.includes("quickload%3APreloadCard");
}

function isTrelloSiteHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "trello.com" || h.endsWith(".trello.com");
}

export function parseTrelloFromRequest(req: CapturedRequest): TrelloCaptureEvent[] {
  if (req.status < 200 || req.status >= 300) return [];
  const at = req.startTime;

  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return [];
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (req.method === "POST" && isTrelloSiteHost(host)) {
    const m = path.match(MARK_VIEWED_PATH);
    if (m?.[1]) return [{ kind: "active", cardId: m[1], at }];
  }

  if (req.method === "GET" && isTrelloSiteHost(host)) {
    const mCheck = path.match(CHECKLIST_PATH);
    if (mCheck?.[1]) {
      const body = tryParseJson(req.responseBody);
      if (isRecord(body)) {
        const checklist = parseChecklistPayload(body);
        if (checklist) return [{ kind: "checklist", checklist, at }];
      }
      return [];
    }

    const mCard = path.match(CARD_PRELOAD_PATH);
    if (mCard && isPreloadCardUrl(url)) {
      const body = tryParseJson(req.responseBody);
      if (!isRecord(body)) return [];
      const card = parseCardPayload(body);
      if (!card) return [];
      return [
        { kind: "active", cardId: card.id, at },
        { kind: "card", card, at },
      ];
    }

    const mBoard = path.match(BOARD_PATH);
    if (mBoard && isCurrentBoardListsCardsRequest(url)) {
      const body = tryParseJson(req.responseBody);
      const bulk = parseBoardBulkPayload(body);
      if (bulk && bulk.cards.length > 0) {
        return [{ kind: "boardBulk", lanes: bulk.lanes, cards: bulk.cards, at }];
      }
      return [];
    }
  }

  if (req.method === "POST" && isTrelloSiteHost(host) && path === "/gateway/api/graphql" && isGraphqlBoardCardsOperation(url)) {
    const body = tryParseJson(req.responseBody);
    const bulk = parseBoardBulkPayload(body);
    if (bulk && bulk.cards.length > 0) {
      return [{ kind: "boardBulk", lanes: bulk.lanes, cards: bulk.cards, at }];
    }
    return [];
  }

  if (req.method === "GET" && host === "api.trello.com") {
    const m = req.url.match(CARDS_API_CHECKLISTS);
    if (!m?.[1]) return [];
    const body = tryParseJson(req.responseBody);
    if (!Array.isArray(body)) return [];
    const checklists: TrelloChecklist[] = [];
    for (const item of body) {
      if (!isRecord(item)) continue;
      const c = parseChecklistPayload(item);
      if (c) checklists.push(c);
    }
    if (!checklists.length) return [];
    return [{ kind: "cardChecklists", cardId: m[1], checklists, at }];
  }

  return [];
}
