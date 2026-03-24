export interface CapturedRequest {
  id: string;
  url: string;
  method: string;
  status: number;
  statusText: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
  startTime: number;
  endTime: number;
  duration: number;
  size: number;
  type: string;
  urlPattern: string;
  initiator: string;
  pageUrl: string;
}

export interface RequestGroup {
  pattern: string;
  requests: CapturedRequest[];
  count: number;
  avgDuration: number;
}

export interface PageSession {
  id: string;
  pageUrl: string;
  domain: string;
  path: string;
  timestamp: number;
  requests: CapturedRequest[];
}

export interface DomainGroup {
  domain: string;
  pages: PageSession[];
  totalRequests: number;
}
