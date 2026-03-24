// Request-related utility functions
import type { CapturedRequest, PageSession, DomainGroup } from "@/types/request";

/**
 * Build JSON summary of requests for copying
 */
export function buildRequestsSummaryJson(requests: CapturedRequest[]) {
  return requests.map((r) => ({
    method: r.method,
    url: r.url,
    status: r.status,
    duration: `${r.duration.toFixed(0)}ms`,
    size: `${r.size}B`,
  }));
}

/**
 * Build JSON summary of a page session
 */
export function buildPageSummaryJson(page: PageSession) {
  return {
    pageUrl: page.pageUrl,
    domain: page.domain,
    path: page.path,
    requestCount: page.requests?.length ?? 0,
    requests: (page.requests ?? []).slice(0, 10).map((r) => ({
      method: r.method,
      url: r.url,
      status: r.status,
      duration: `${r.duration.toFixed(0)}ms`,
    })),
    ...((page.requests?.length ?? 0) > 10 && {
      truncated: `... and ${(page.requests?.length ?? 0) - 10} more requests`,
    }),
  };
}

/**
 * Build JSON summary of a domain group
 */
export function buildDomainSummaryJson(domain: DomainGroup) {
  return {
    domain: domain.domain,
    totalRequests: domain.totalRequests,
    pages: domain.pages.map((p) => ({
      path: p.path,
      requestCount: p.requests?.length ?? 0,
      requests: (p.requests ?? []).slice(0, 5).map((r) => ({
        method: r.method,
        url: r.url,
        status: r.status,
      })),
      ...((p.requests?.length ?? 0) > 5 && {
        truncated: `... and ${(p.requests?.length ?? 0) - 5} more`,
      }),
    })),
  };
}

/**
 * Get unique HTTP methods from requests
 */
export function getUniqueMethods(requests: CapturedRequest[]): string[] {
  const methods = new Set(requests.map((r) => r.method));
  return Array.from(methods).sort();
}
