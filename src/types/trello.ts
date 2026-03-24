export interface TrelloCheckItem {
  id: string;
  name: string;
  state: string;
}

export interface TrelloChecklist {
  id: string;
  name: string;
  checkItems?: TrelloCheckItem[];
}

export interface TrelloAttachment {
  id?: string;
  name?: string;
  url?: string;
  mimeType?: string;
  previews?: Array<{ url?: string; width?: number; height?: number }>;
}

export interface TrelloCardFields {
  id: string;
  shortLink?: string;
  name?: string;
  desc?: string;
  url?: string;
  shortUrl?: string;
  idList?: string;
  idChecklists?: string[];
  attachments?: TrelloAttachment[];
}

export interface TrelloLane {
  id: string;
  name: string;
  pos: number;
}

export type TrelloCaptureEvent =
  | { kind: "active"; cardId: string; at: number }
  | { kind: "card"; card: TrelloCardFields; at: number }
  | { kind: "checklist"; checklist: TrelloChecklist; at: number }
  | { kind: "cardChecklists"; cardId: string; checklists: TrelloChecklist[]; at: number }
  | { kind: "boardBulk"; lanes: TrelloLane[]; cards: TrelloCardFields[]; at: number };

export interface TrelloAggregateState {
  cards: Record<string, TrelloCardFields>;
  lanes: Record<string, TrelloLane>;
  checklists: Record<string, TrelloChecklist>;
  cardLastSeen: Record<string, number>;
  activeCardId: string | null;
  activeUpdatedAt: number;
}

export interface TrelloDetectedCardRow {
  id: string;
  lastSeen: number;
  fields: TrelloCardFields;
}

export interface TrelloCardExport {
  id: string;
  shortLink?: string;
  name?: string;
  desc?: string;
  url?: string;
  shortUrl?: string;
  laneName?: string;
  checklists: TrelloChecklist[];
  imageUrls: string[];
  attachmentUrls: Array<{ name: string; url: string }>;
}
