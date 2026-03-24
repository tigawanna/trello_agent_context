# TanStack DB Migration Research

## Overview

TanStack DB would transform the current `useRequestStore` from manual state management with `useState` + `useMemo` to a **reactive, collection-based architecture** with automatic derived state.

## Current Architecture Problems

```typescript
// Current: Manual state + derived computations
const [requests, setRequests] = useState<CapturedRequest[]>([]);
const [pageSessions, setPageSessions] = useState<PageSession[]>([]);

// Manual sync between two state arrays
const addRequest = (request) => {
  setRequests((prev) => [...prev, newRequest]);
  setPageSessions((prev) => {
    // Manual immutable update to keep in sync
    return prev.map((session, idx) => 
      idx === sessionIndex 
        ? { ...session, requests: [...session.requests, newRequest] }
        : session
    );
  });
};

// Derived state (React Compiler handles memoization automatically)
const groupedRequests = /* expensive computation */;
const domainGroups = /* expensive computation */;
```

> **Note:** This project uses React 19 with React Compiler - no manual `useMemo`/`useCallback` needed.

**Issues:**
1. Dual state arrays must be kept in sync manually
2. Derived state still recomputes fully on any change (even with compiler optimization)
3. No optimistic UI pattern - mutations block until state updates
4. Filtering requires re-running entire computation

---

## TanStack DB Architecture

### Collections (Normalized Data Stores)

```typescript
import { createCollection, createLocalCollection } from '@tanstack/db'

// Primary collection: All captured requests
export const requestsCollection = createLocalCollection<CapturedRequest>({
  id: 'requests',
  primaryKey: 'id',
})

// Secondary collection: Page sessions (can be derived or standalone)
export const pageSessionsCollection = createLocalCollection<PageSession>({
  id: 'page-sessions', 
  primaryKey: 'id',
})
```

### Optimistic Inserts

```typescript
// Instantly applies to all live queries - no waiting
export function addRequest(request: Omit<CapturedRequest, 'id' | 'urlPattern'>) {
  const newRequest: CapturedRequest = {
    ...request,
    id: crypto.randomUUID(),
    urlPattern: generateUrlPattern(request.url),
  }
  
  // Optimistic insert - immediately reflected in all queries
  requestsCollection.insert(newRequest)
  
  // Sessions can be auto-derived OR manually managed
  const { domain, path } = parsePageUrl(request.pageUrl)
  const existingSession = pageSessionsCollection.findOne({ pageUrl: request.pageUrl })
  
  if (!existingSession) {
    pageSessionsCollection.insert({
      id: crypto.randomUUID(),
      pageUrl: request.pageUrl,
      domain,
      path,
      timestamp: Date.now(),
    })
  }
}
```

### Live Queries (Derived State)

```typescript
import { useLiveQuery, eq, like, and, desc } from '@tanstack/db/react'

// Replaces: const groupedRequests = useMemo(() => {...}, [requests])
function useGroupedRequests() {
  return useLiveQuery((q) =>
    q.from({ req: requestsCollection })
      .groupBy(({ req }) => req.urlPattern)
      .select(({ req, $count, $avg }) => ({
        pattern: req.urlPattern,
        count: $count(),
        avgDuration: $avg(req.duration),
        requests: req, // Nested collection
      }))
      .orderBy(({ count }) => count, 'desc')
  )
}

// Replaces: const domainGroups = useMemo(() => {...}, [pageSessions])
function useDomainGroups() {
  return useLiveQuery((q) =>
    q.from({ session: pageSessionsCollection })
      .join({ req: requestsCollection }, ({ session, req }) => 
        eq(session.pageUrl, req.pageUrl)
      )
      .groupBy(({ session }) => session.domain)
      .select(({ session, req, $count }) => ({
        domain: session.domain,
        pages: session,
        totalRequests: $count(req),
      }))
      .orderBy(({ totalRequests }) => totalRequests, 'desc')
  )
}

// Replaces: const filteredRequests = useMemo(() => {...}, [requests, search, methodFilter])
function useFilteredRequests(search: string, method: string, segment: string) {
  return useLiveQuery((q) => {
    let query = q.from({ req: requestsCollection })
    
    if (search) {
      query = query.where(({ req }) => like(req.url, `%${search}%`))
    }
    if (method !== 'ALL') {
      query = query.where(({ req }) => eq(req.method, method))
    }
    if (segment !== 'ALL') {
      query = query.where(({ req }) => like(req.url, `%/${segment}/%`))
    }
    
    return query.orderBy(({ req }) => req.startTime, 'desc')
  }, [search, method, segment]) // Dependencies for query recomputation
}
```

### Key Benefits

| Current (useState + useMemo) | TanStack DB |
|------------------------------|-------------|
| Full recompute on any change | **Differential dataflow** - only affected parts recompute |
| Manual state sync | **Single source of truth** with derived queries |
| O(n) filter operations | **Indexed queries** with sub-ms updates |
| Manual optimistic patterns | **Built-in optimistic mutations** |
| Prop drilling derived state | **Queries anywhere** - components declare their needs |

---

## Migration Path

### Phase 1: Add Collections (Parallel)
Keep existing `useState` but add collections that mirror the data:

```typescript
// Existing code still works
const [requests, setRequests] = useState<CapturedRequest[]>([])

// New: Mirror to collection on insert
const addRequest = useCallback((request) => {
  const newRequest = { ... }
  setRequests((prev) => [...prev, newRequest])
  requestsCollection.insert(newRequest) // Mirror
}, [])
```

### Phase 2: Replace Derived State
Switch `useMemo` computations to `useLiveQuery`:

```typescript
// Before
const groupedRequests = useMemo(() => { /* ... */ }, [requests])

// After
const { data: groupedRequests } = useGroupedRequests()
```

### Phase 3: Remove useState
Once all consumers use live queries, remove the `useState` arrays:

```typescript
// Final: Collections are the source of truth
export function useRequestStore() {
  const { data: requests } = useLiveQuery((q) => 
    q.from({ req: requestsCollection })
  )
  const { data: groupedRequests } = useGroupedRequests()
  const { data: domainGroups } = useDomainGroups()
  
  return {
    requests,
    groupedRequests,
    domainGroups,
    addRequest,
    clearRequests: () => requestsCollection.clear(),
    // ...
  }
}
```

---

## Component-Level Queries

The real power: components query exactly what they need.

```typescript
// SessionsView.tsx - Only queries domains it renders
function DomainView({ domain }: { domain: string }) {
  // Live query scoped to this domain
  const { data: pages } = useLiveQuery((q) =>
    q.from({ session: pageSessionsCollection })
      .where(({ session }) => eq(session.domain, domain))
      .orderBy(({ session }) => session.timestamp, 'desc')
  , [domain])
  
  const { data: jwt } = useLiveQuery((q) =>
    q.from({ req: requestsCollection })
      .where(({ req }) => and(
        like(req.pageUrl, `%${domain}%`),
        like(req.requestHeaders.Authorization, 'Bearer%')
      ))
      .limit(1)
  , [domain])
  
  // ...
}

// RequestList.tsx - Filters are query parameters, not post-processing
function RequestList({ viewMode }: Props) {
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('ALL')
  const [segment, setSegment] = useState('ALL')
  
  // Query automatically updates when filters change
  // Only fetches/computes matching requests
  const { data: requests } = useFilteredRequests(search, method, segment)
  
  // Route segments derived from requests
  const { data: segments } = useLiveQuery((q) =>
    q.from({ req: requestsCollection })
      .select(({ req }) => extractSegment(req.url))
      .distinct()
  )
  
  // ...
}
```

---

## Performance Comparison

**Current: 1000 requests, filter change**
1. `useMemo` triggers full recompute
2. `.filter()` iterates all 1000 requests
3. `.sort()` sorts filtered results
4. React diffs and re-renders

**TanStack DB: 1000 requests, filter change**
1. Differential engine identifies affected rows
2. Updates only changed portions of query result
3. Returns stable references for unchanged items
4. Minimal React re-render

**Benchmark (from TanStack docs):**
> Updating one row in a sorted 100,000-item collection: **~0.7ms**

---

## Persistence (Optional)

TanStack DB can persist to IndexedDB automatically:

```typescript
import { createCollection, queryCollectionOptions } from '@tanstack/db'
import { useQuery } from '@tanstack/react-query'

// Persist to IndexedDB via TanStack Query
const requestsCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['requests'],
    queryFn: () => loadFromIndexedDB('requests'),
    gcTime: Infinity, // Keep in memory
    staleTime: Infinity, // Never refetch
  })
)

// On insert, also persist
requestsCollection.config.onInsert = async ({ transaction }) => {
  await saveToIndexedDB('requests', transaction.mutations)
}
```

---

## Conclusion

TanStack DB would:
1. **Eliminate sync bugs** - Single collection, multiple derived views
2. **Improve performance** - Differential updates vs full recomputes  
3. **Simplify code** - Declarative queries replace imperative state management
4. **Enable component-level data needs** - No prop drilling
5. **Built-in optimistic mutations** - Instant UI feedback

**Recommended**: Start with Phase 1 (parallel collections) to evaluate before full migration.

---

## Resources

- [TanStack DB Docs](https://tanstack.com/db/latest/docs/overview)
- [Query-Driven Sync Blog Post](https://tanstack.com/blog/tanstack-db-0.5-query-driven-sync)
- [Differential Dataflow (d2ts)](https://github.com/electric-sql/d2ts)
