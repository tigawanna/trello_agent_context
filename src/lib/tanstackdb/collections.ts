import { generateUrlPattern as generatePattern } from "@/lib/url";
import type { CapturedRequest, PageSession } from "@/types/request";
import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { QueryClient } from "@tanstack/react-query";

// Shared query client for collections
export const collectionQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Data doesn't go stale (we control it via direct writes)
      gcTime: Infinity, // Never garbage collect
    },
  },
});

// Primary collection: All captured network requests
export const requestsCollection = createCollection(
  queryCollectionOptions<CapturedRequest>({
    id: "requests",
    queryKey: ["requests"],
    queryFn: async () => [], // No server fetch - we populate via direct writes
    queryClient: collectionQueryClient,
    getKey: (item) => item.id,
    enabled: false, // Don't auto-fetch
  })
);

// Secondary collection: Page sessions grouped by URL
export const pageSessionsCollection = createCollection(
  queryCollectionOptions<PageSession>({
    id: "page-sessions",
    queryKey: ["page-sessions"],
    queryFn: async () => [], // No server fetch - we populate via direct writes
    queryClient: collectionQueryClient,
    getKey: (item) => item.id,
    enabled: false, // Don't auto-fetch
  })
);

// Re-export shared utilities for backward compatibility
export { generateUrlPattern, parsePageUrl } from "@/lib/url";

// GC Configuration - can be updated dynamically from settings
let gcConfig = {
  maxRequestsPerEndpoint: 50,
  maxTotalRequests: 500,
};

/** Update garbage collection configuration from settings */
export function updateGCConfig(config: { maxRequestsPerEndpoint: number; maxTotalRequests: number }) {
  gcConfig = { ...config };
}

/** Get all requests currently in the collection */
function getAllRequests(): CapturedRequest[] {
  const state = collectionQueryClient.getQueryData<Record<string, CapturedRequest>>(["requests"]);
  if (!state) return [];
  return Object.values(state);
}

/**
 * Garbage collect old requests to prevent memory bloat and UI freezing.
 * Uses FIFO (First In, First Out) strategy - oldest requests are removed first.
 * 
 * Called automatically when adding new requests.
 */
export function garbageCollectRequests(): number {
  const allRequests = getAllRequests();
  const toDelete: string[] = [];

  // 1. Enforce per-endpoint limit
  // Group by URL pattern and keep only the most recent N requests per pattern
  const byPattern = new Map<string, CapturedRequest[]>();
  for (const req of allRequests) {
    const existing = byPattern.get(req.urlPattern) ?? [];
    byPattern.set(req.urlPattern, [...existing, req]);
  }

  for (const [pattern, requests] of byPattern) {
    if (requests.length > gcConfig.maxRequestsPerEndpoint) {
      // Sort by startTime descending (newest first)
      const sorted = [...requests].sort((a, b) => b.startTime - a.startTime);
      // Mark older ones for deletion
      const excess = sorted.slice(gcConfig.maxRequestsPerEndpoint);
      excess.forEach(r => toDelete.push(r.id));
    }
  }

  // 2. Enforce total limit (after per-endpoint cleanup)
  const remainingCount = allRequests.length - toDelete.length;
  if (remainingCount > gcConfig.maxTotalRequests) {
    // Get all requests not already marked for deletion
    const deleteSet = new Set(toDelete);
    const remaining = allRequests
      .filter(r => !deleteSet.has(r.id))
      .sort((a, b) => b.startTime - a.startTime); // newest first
    
    // Mark oldest ones for deletion to get under the limit
    const excessTotal = remaining.slice(gcConfig.maxTotalRequests);
    excessTotal.forEach(r => toDelete.push(r.id));
  }

  // Perform deletions
  if (toDelete.length > 0) {
    console.log(`[RequestVisualizer GC] Cleaning up ${toDelete.length} old requests (limit: ${gcConfig.maxRequestsPerEndpoint}/endpoint, ${gcConfig.maxTotalRequests} total)`);
    for (const id of toDelete) {
      requestsCollection.utils.writeDelete(id);
    }
  }

  return toDelete.length;
}

// Throttle GC to prevent excessive processing during bursts
let gcPending = false;
let gcTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleGC() {
  if (gcPending) return;
  gcPending = true;
  
  // Clear any existing timeout
  if (gcTimeout) clearTimeout(gcTimeout);
  
  // Schedule GC to run after a small delay to batch multiple rapid adds
  gcTimeout = setTimeout(() => {
    garbageCollectRequests();
    gcPending = false;
  }, 100); // 100ms debounce
}

// Add a new request - uses direct write for immediate update
export function addRequest(
  request: Omit<CapturedRequest, "id" | "urlPattern">
): CapturedRequest {
  const newRequest: CapturedRequest = {
    ...request,
    id: crypto.randomUUID(),
    urlPattern: generatePattern(request.url),
  };

  // Direct write to synced store - immediately visible in all live queries
  requestsCollection.utils.writeInsert(newRequest);

  // Schedule garbage collection (debounced to handle bursts)
  scheduleGC();

  return newRequest;
}
