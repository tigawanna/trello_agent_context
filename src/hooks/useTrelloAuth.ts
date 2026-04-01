import type { CapturedRequest } from "@/types/request";
import type { TrelloAuthInfo } from "@/types/trelloAuth";
import { extractJWTFromHeaders } from "@/lib/jwt";
import { useEffect, useRef, useState } from "react";

const EMPTY_AUTH: TrelloAuthInfo = {
  apiToken: null,
  apiKey: null,
  jwtToken: null,
  jwtHeaderName: null,
  cookie: null,
  lastUpdated: 0,
};

const JWT_HEADER_NAMES = ["Authorization", "authorization", "X-Trello-Token"];

function extractTrelloQueryToken(url: string): { key?: string; token?: string } {
  try {
    const u = new URL(url);
    const key = u.searchParams.get("key") ?? undefined;
    const token = u.searchParams.get("token") ?? undefined;
    return { key, token };
  } catch {
    return {};
  }
}

function isTrelloApiUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "trello.com" || h.endsWith(".trello.com") || h === "api.trello.com";
  } catch {
    return false;
  }
}

export function useTrelloAuth(requests: CapturedRequest[]): TrelloAuthInfo {
  const [auth, setAuth] = useState<TrelloAuthInfo>(EMPTY_AUTH);
  const processedCount = useRef(0);

  useEffect(() => {
    if (requests.length === 0) {
      processedCount.current = 0;
      setAuth(EMPTY_AUTH);
      return;
    }
  }, [requests.length]);

  useEffect(() => {
    if (requests.length <= processedCount.current) return;

    const newRequests = requests.slice(processedCount.current);
    processedCount.current = requests.length;

    let updated = false;
    let nextAuth = { ...auth };

    for (const req of newRequests) {
      if (!isTrelloApiUrl(req.url)) continue;

      const { key, token } = extractTrelloQueryToken(req.url);
      if (token && token !== nextAuth.apiToken) {
        nextAuth = { ...nextAuth, apiToken: token, lastUpdated: req.startTime };
        updated = true;
      }
      if (key && key !== nextAuth.apiKey) {
        nextAuth = { ...nextAuth, apiKey: key, lastUpdated: req.startTime };
        updated = true;
      }

      const jwtInfo = extractJWTFromHeaders(req.requestHeaders, JWT_HEADER_NAMES);
      if (jwtInfo && jwtInfo.rawToken !== nextAuth.jwtToken) {
        nextAuth = {
          ...nextAuth,
          jwtToken: jwtInfo.rawToken,
          jwtHeaderName: jwtInfo.header,
          lastUpdated: req.startTime,
        };
        updated = true;
      }

      const cookie = req.requestHeaders["cookie"] ?? req.requestHeaders["Cookie"];
      if (cookie && cookie !== nextAuth.cookie) {
        nextAuth = { ...nextAuth, cookie, lastUpdated: req.startTime };
        updated = true;
      }
    }

    if (updated) setAuth(nextAuth);
  }, [requests, auth]);

  return auth;
}
