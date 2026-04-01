export interface TrelloAuthInfo {
  apiToken: string | null;
  apiKey: string | null;
  jwtToken: string | null;
  jwtHeaderName: string | null;
  cookie: string | null;
  lastUpdated: number;
}

export interface EmbeddedImage {
  originalUrl: string;
  dataUri: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SavedImage {
  originalUrl: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
}
