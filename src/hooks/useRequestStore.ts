import { useState, useCallback, useMemo } from "react";
import type { CapturedRequest, RequestGroup, PageSession, DomainGroup } from "@/types/request";

function generateUrlPattern(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    const patternParts = pathParts.map((part) => {
      if (/^\d+$/.test(part)) return ":id";
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          part
        )
      )
        return ":uuid";
      if (/^[0-9a-f]{24}$/i.test(part)) return ":objectId";
      return part;
    });
    return `${urlObj.origin}/${patternParts.join("/")}`;
  } catch {
    return url;
  }
}

function parsePageUrl(pageUrl: string): { domain: string; path: string } {
  try {
    const urlObj = new URL(pageUrl);
    return { domain: urlObj.hostname, path: urlObj.pathname };
  } catch {
    return { domain: "unknown", path: "/" };
  }
}

export function useRequestStore() {
  const [requests, setRequests] = useState<CapturedRequest[]>([]);
  const [pageSessions, setPageSessions] = useState<PageSession[]>([]);
  const [currentPageUrl, setCurrentPageUrl] = useState<string>("unknown");
  const [selectedRequest, setSelectedRequest] = useState<CapturedRequest | null>(null);

  const cleanupOldSessions = useCallback((retentionHours: number) => {
    const cutoffTime = Date.now() - retentionHours * 60 * 60 * 1000;
    
    setPageSessions((prev) => {
      const filtered = prev.filter((s) => s.timestamp >= cutoffTime);
      if (filtered.length !== prev.length) {
        console.log(`[RequestVisualizer] Cleaned up ${prev.length - filtered.length} old sessions`);
      }
      return filtered;
    });
    
    setRequests((prev) => {
      const validPageUrls = new Set<string>();
      setPageSessions((sessions) => {
        sessions.forEach((s) => validPageUrls.add(s.pageUrl));
        return sessions;
      });
      return prev.filter((r) => {
        const { domain } = parsePageUrl(r.pageUrl);
        // Keep requests from sessions that haven't been cleaned up
        return validPageUrls.has(r.pageUrl) || r.startTime >= cutoffTime;
      });
    });
  }, []);

  const addRequest = useCallback((request: Omit<CapturedRequest, "id" | "urlPattern">) => {
    const newRequest: CapturedRequest = {
      ...request,
      id: crypto.randomUUID(),
      urlPattern: generateUrlPattern(request.url),
    };
    setRequests((prev) => [...prev, newRequest]);
    
    // Also add to page session - create session if needed
    setPageSessions((prev) => {
      const sessionIndex = prev.findIndex((s) => s.pageUrl === request.pageUrl);
      
      if (sessionIndex >= 0) {
        // Update existing session with new request (immutable update)
        return prev.map((session, idx) => 
          idx === sessionIndex 
            ? { ...session, requests: [...session.requests, newRequest] }
            : session
        );
      }
      
      // Create new session if one doesn't exist for this pageUrl
      const { domain, path } = parsePageUrl(request.pageUrl);
      const newSession: PageSession = {
        id: crypto.randomUUID(),
        pageUrl: request.pageUrl,
        domain,
        path,
        timestamp: Date.now(),
        requests: [newRequest],
      };
      return [...prev, newSession];
    });
    
    return newRequest;
  }, []);

  const onNavigate = useCallback((newUrl: string) => {
    setCurrentPageUrl(newUrl);
    const { domain, path } = parsePageUrl(newUrl);
    
    // Check if we already have a session for this exact URL
    setPageSessions((prev) => {
      const existingSession = prev.find((s) => s.pageUrl === newUrl);
      if (existingSession) {
        return prev; // Already tracking this page
      }
      
      // Create new page session
      const newSession: PageSession = {
        id: crypto.randomUUID(),
        pageUrl: newUrl,
        domain,
        path,
        timestamp: Date.now(),
        requests: [],
      };
      return [...prev, newSession];
    });
  }, []);

  const clearRequests = useCallback(() => {
    setRequests([]);
    setPageSessions([]);
    setSelectedRequest(null);
  }, []);

  const clearDomain = useCallback((domain: string) => {
    setPageSessions((prev) => prev.filter((s) => s.domain !== domain));
    setRequests((prev) => {
      const { domain: reqDomain } = parsePageUrl(prev[0]?.pageUrl ?? "");
      return prev.filter((r) => {
        const { domain: d } = parsePageUrl(r.pageUrl);
        return d !== domain;
      });
    });
  }, []);

  const clearPage = useCallback((pageUrl: string) => {
    setPageSessions((prev) => prev.filter((s) => s.pageUrl !== pageUrl));
    setRequests((prev) => prev.filter((r) => r.pageUrl !== pageUrl));
  }, []);

  // Group requests by URL pattern (current view)
  const groupedRequests = useMemo((): RequestGroup[] => {
    const groups = new Map<string, CapturedRequest[]>();
    
    for (const request of requests) {
      const existing = groups.get(request.urlPattern) ?? [];
      groups.set(request.urlPattern, [...existing, request]);
    }
    
    return Array.from(groups.entries()).map(([pattern, reqs]) => ({
      pattern,
      requests: reqs.sort((a, b) => a.startTime - b.startTime),
      count: reqs.length,
      avgDuration: reqs.reduce((sum, r) => sum + r.duration, 0) / reqs.length,
    }));
  }, [requests]);

  // Group by domain -> pages
  const domainGroups = useMemo((): DomainGroup[] => {
    const domains = new Map<string, PageSession[]>();
    
    for (const session of pageSessions) {
      const existing = domains.get(session.domain) ?? [];
      domains.set(session.domain, [...existing, session]);
    }
    
    return Array.from(domains.entries())
      .map(([domain, pages]) => ({
        domain,
        pages: pages.sort((a, b) => b.timestamp - a.timestamp),
        totalRequests: pages.reduce((sum, p) => sum + p.requests.length, 0),
      }))
      .sort((a, b) => b.totalRequests - a.totalRequests);
  }, [pageSessions]);

  return {
    requests,
    selectedRequest,
    setSelectedRequest,
    addRequest,
    onNavigate,
    clearRequests,
    clearDomain,
    clearPage,
    cleanupOldSessions,
    groupedRequests,
    domainGroups,
    currentPageUrl,
    pageSessions,
  };
}
