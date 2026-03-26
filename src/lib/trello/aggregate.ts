import type {
  TrelloAggregateState,
  TrelloCaptureEvent,
  TrelloCardExport,
  TrelloCardFields,
  TrelloDetectedCardRow,
  TrelloLane,
} from "@/types/trello";

const initial: TrelloAggregateState = {
  cards: {},
  lanes: {},
  checklists: {},
  cardLastSeen: {},
  activeCardId: null,
  activeUpdatedAt: 0,
};

function touchCard(state: TrelloAggregateState, cardId: string, at: number): Record<string, number> {
  const prev = state.cardLastSeen[cardId] ?? 0;
  return { ...state.cardLastSeen, [cardId]: Math.max(prev, at) };
}

function bumpCardsWithChecklist(state: TrelloAggregateState, checklistId: string, at: number): Record<string, number> {
  let next = state.cardLastSeen;
  let changed = false;
  for (const [cardId, card] of Object.entries(state.cards)) {
    if (card.idChecklists?.includes(checklistId)) {
      const prev = next[cardId] ?? 0;
      const v = Math.max(prev, at);
      if (!changed) {
        next = { ...state.cardLastSeen };
        changed = true;
      }
      next[cardId] = v;
    }
  }
  return next;
}

function mergeCard(prev: TrelloCardFields | undefined, incoming: TrelloCardFields): TrelloCardFields {
  if (!prev) return { ...incoming };
  return {
    ...prev,
    ...incoming,
    idChecklists: incoming.idChecklists ?? prev.idChecklists,
    attachments: incoming.attachments ?? prev.attachments,
    shortLink: incoming.shortLink ?? prev.shortLink,
    name: incoming.name ?? prev.name,
    desc: incoming.desc ?? prev.desc,
    url: incoming.url ?? prev.url,
    shortUrl: incoming.shortUrl ?? prev.shortUrl,
    idList: incoming.idList ?? prev.idList,
  };
}

export function reduceTrelloState(state: TrelloAggregateState, events: TrelloCaptureEvent[]): TrelloAggregateState {
  let next: TrelloAggregateState = state;
  for (const ev of events) {
    next = applyEvent(next, ev);
  }
  return next;
}

function applyEvent(state: TrelloAggregateState, ev: TrelloCaptureEvent): TrelloAggregateState {
  if (ev.kind === "active") {
    const cards = { ...state.cards };
    cards[ev.cardId] = mergeCard(cards[ev.cardId], { id: ev.cardId });
    const cardLastSeen = touchCard(state, ev.cardId, ev.at);
    if (ev.at < state.activeUpdatedAt) {
      return { ...state, cards, cardLastSeen };
    }
    return {
      ...state,
      cards,
      cardLastSeen,
      activeCardId: ev.cardId,
      activeUpdatedAt: ev.at,
    };
  }
  if (ev.kind === "card") {
    const cards = { ...state.cards };
    cards[ev.card.id] = mergeCard(cards[ev.card.id], ev.card);
    const cardLastSeen = touchCard(state, ev.card.id, ev.at);
    let activeCardId = state.activeCardId;
    let activeUpdatedAt = state.activeUpdatedAt;
    if (ev.at >= activeUpdatedAt) {
      activeCardId = ev.card.id;
      activeUpdatedAt = ev.at;
    }
    return { ...state, cards, cardLastSeen, activeCardId, activeUpdatedAt };
  }
  if (ev.kind === "checklist") {
    const checklists = { ...state.checklists, [ev.checklist.id]: ev.checklist };
    const cardLastSeen = bumpCardsWithChecklist({ ...state, checklists }, ev.checklist.id, ev.at);
    return { ...state, checklists, cardLastSeen };
  }
  if (ev.kind === "cardChecklists") {
    const cards = { ...state.cards };
    const existing = cards[ev.cardId];
    const mergedCard: TrelloCardFields = existing
      ? mergeCard(existing, {
          id: ev.cardId,
          idChecklists: ev.checklists.map((c) => c.id),
        })
      : {
          id: ev.cardId,
          idChecklists: ev.checklists.map((c) => c.id),
        };
    cards[ev.cardId] = mergedCard;
    const checklists = { ...state.checklists };
    for (const c of ev.checklists) {
      checklists[c.id] = c;
    }
    const cardLastSeen = touchCard({ ...state, cards }, ev.cardId, ev.at);
    return { ...state, cards, checklists, cardLastSeen };
  }
  if (ev.kind === "boardBulk") {
    const lanes = { ...state.lanes };
    for (const lane of ev.lanes) {
      lanes[lane.id] = lane;
    }
    const cards = { ...state.cards };
    let cardLastSeen = { ...state.cardLastSeen };
    for (const c of ev.cards) {
      cards[c.id] = mergeCard(cards[c.id], c);
      const prev = cardLastSeen[c.id] ?? 0;
      cardLastSeen[c.id] = Math.max(prev, ev.at);
    }
    return { ...state, lanes, cards, cardLastSeen };
  }
  return state;
}

export function createInitialTrelloState(): TrelloAggregateState {
  return {
    cards: {},
    lanes: {},
    checklists: {},
    cardLastSeen: {},
    activeCardId: null,
    activeUpdatedAt: 0,
  };
}

function collectImageUrls(card: TrelloCardFields, checklists: TrelloAggregateState["checklists"]): string[] {
  const urls = new Set<string>();
  const attachments = card.attachments ?? [];
  for (const a of attachments) {
    const mime = (a.mimeType ?? "").toLowerCase();
    if (mime.startsWith("image/") && a.url) urls.add(a.url);
    if (a.previews) {
      for (const p of a.previews) {
        if (p.url) urls.add(p.url);
      }
    }
  }
  const ids = card.idChecklists ?? [];
  for (const cid of ids) {
    const cl = checklists[cid];
    const items = cl?.checkItems ?? [];
    for (const it of items) {
      const name = it.name ?? "";
      const md = name.match(/!\[[^\]]*]\((https?:[^)]+)\)/);
      if (md?.[1]) urls.add(md[1]);
      const bare = name.match(/(https?:\/\/[^\s)]+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s)]*)?)/i);
      if (bare?.[1]) urls.add(bare[1]);
    }
  }
  return Array.from(urls);
}

function attachmentPairs(card: TrelloCardFields): Array<{ name: string; url: string }> {
  const out: Array<{ name: string; url: string }> = [];
  for (const a of card.attachments ?? []) {
    if (a.url) out.push({ name: a.name ?? a.url, url: a.url });
  }
  return out;
}

export function buildCardExport(state: TrelloAggregateState, cardId: string): TrelloCardExport {
  const card = state.cards[cardId];
  const ids = card?.idChecklists ?? [];
  const checklists = ids
    .map((cid) => state.checklists[cid])
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (!card) {
    return {
      id: cardId,
      checklists,
      imageUrls: [],
      attachmentUrls: [],
    };
  }
  const laneName = card.idList ? state.lanes[card.idList]?.name : undefined;
  return {
    id: card.id,
    shortLink: card.shortLink,
    name: card.name,
    desc: card.desc,
    url: card.url,
    shortUrl: card.shortUrl,
    laneName,
    checklists,
    imageUrls: collectImageUrls(card, state.checklists),
    attachmentUrls: attachmentPairs(card),
  };
}

export function buildActiveExport(state: TrelloAggregateState): TrelloCardExport | null {
  if (!state.activeCardId) return null;
  return buildCardExport(state, state.activeCardId);
}

export function listLanesSorted(state: TrelloAggregateState): TrelloLane[] {
  return Object.values(state.lanes).sort((a, b) => a.pos - b.pos || a.name.localeCompare(b.name));
}

function matchesSearch(
  fields: TrelloCardFields,
  lanes: Record<string, TrelloLane>,
  query: string
): boolean {
  const q = query.toLowerCase();
  if (fields.name?.toLowerCase().includes(q)) return true;
  if (fields.desc?.toLowerCase().includes(q)) return true;
  if (fields.shortLink?.toLowerCase().includes(q)) return true;
  if (fields.id.toLowerCase().includes(q)) return true;
  if (fields.idList) {
    const lane = lanes[fields.idList];
    if (lane?.name.toLowerCase().includes(q)) return true;
  }
  return false;
}

export function listDetectedCards(
  state: TrelloAggregateState,
  laneId: string | null,
  searchQuery?: string
): TrelloDetectedCardRow[] {
  const rows: TrelloDetectedCardRow[] = [];
  const normalizedQuery = searchQuery?.trim() ?? "";
  for (const id of Object.keys(state.cards)) {
    const fields = state.cards[id];
    if (laneId && fields.idList !== laneId) continue;
    if (normalizedQuery && !matchesSearch(fields, state.lanes, normalizedQuery)) continue;
    rows.push({
      id,
      lastSeen: state.cardLastSeen[id] ?? 0,
      fields,
    });
  }
  rows.sort((a, b) => b.lastSeen - a.lastSeen);
  return rows;
}

export function formatTrelloMarkdown(exp: TrelloCardExport): string {
  const lines: string[] = [];
  const title = exp.name?.trim() || "Trello card";
  lines.push(`# ${title}`);
  const link = exp.shortUrl ?? exp.url ?? (exp.shortLink ? `https://trello.com/c/${exp.shortLink}` : "");
  if (link) lines.push("", `**Link:** ${link}`);
  if (exp.laneName) lines.push("", `**Lane:** ${exp.laneName}`);
  lines.push("", "## Description", "", exp.desc?.trim() || "_No description_");
  lines.push("", "## Checklists");
  if (!exp.checklists.length) {
    lines.push("", "_No checklist data captured yet — open the card so checklists load._");
  } else {
    for (const cl of exp.checklists) {
      lines.push("", `### ${cl.name}`);
      const items = cl.checkItems ?? [];
      if (!items.length) lines.push("- _Empty_");
      else {
        for (const it of items) {
          const done = it.state === "complete";
          lines.push(`- [${done ? "x" : " "}] ${it.name}`);
        }
      }
    }
  }
  lines.push("", "## Attachments");
  if (!exp.attachmentUrls.length) lines.push("", "_None in captured payload._");
  else {
    for (const a of exp.attachmentUrls) {
      lines.push(`- [${a.name}](${a.url})`);
    }
  }
  lines.push("", "## Image URLs (plain)");
  if (!exp.imageUrls.length) lines.push("", "_None detected._");
  else {
    for (const u of exp.imageUrls) {
      lines.push(`- ${u}`);
    }
  }
  lines.push("", "## JSON (for tools)", "", "```json", JSON.stringify(exp, null, 2), "```");
  return lines.join("\n");
}
