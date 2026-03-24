# Chrome Requests Visualizer

A Chrome DevTools extension for visualizing network requests, detecting N+1 query patterns, replaying requests, and decoding JWTs. Built for developers who want to debug API calls, identify performance bottlenecks, and inspect authentication tokens.

<!-- TODO: Add hero screenshot -->
<img width="1047" height="891" alt="image" src="https://github.com/user-attachments/assets/188e2ed2-dbc5-404d-944b-2eeba9508045" />


## ✨ Features

### 🔍 Network Request Monitoring
Captures XHR, Fetch, and Document requests made by the current page. Unlike the built-in Network tab, this extension focuses specifically on API calls and provides specialized views for debugging.

- **Status indicators** - Color-coded dots show request status at a glance
- **Search & Filter** - Filter by URL, method (GET, POST, etc.), and sort by time/status
- **Request count** - See filtered vs total request counts

<!-- TODO: Add request list screenshot -->
<img width="1047" height="891" alt="image" src="https://github.com/user-attachments/assets/8272d2a0-cc9c-4b89-b3db-b67142ad0b68" />


### 🔗 N+1 Query Detection
Automatically groups requests by URL pattern to identify N+1 query problems:

- `/api/users/1`, `/api/users/2`, `/api/users/3` → grouped as `/api/users/:id` (3x)
- Smart pattern detection for IDs, UUIDs, and MongoDB ObjectIDs
- Expandable groups to see individual requests

<!-- TODO: Add N+1 detection screenshot -->


### 🌐 Session Persistence
Track requests across page navigations within a browsing session:

- **Domain grouping** - Requests organized by domain (e.g., `github.com`, `api.github.com`)
- **Page grouping** - Further grouped by page path (`/`, `/repos`, `/settings`)
- **Copy as JSON** - Export domain or page request summaries
- **Retention settings** - Configure how long to keep sessions (1 hour to 1 week)

<!-- TODO: Add sessions view screenshot -->
<img width="1047" height="891" alt="image" src="https://github.com/user-attachments/assets/f6006125-0b02-43a9-b77e-ccf32db21481" />


### 🔄 Request Replay
Replay any captured request with full editing capabilities:

- **Edit URL, method, headers, and body** before replaying
- **Cross-origin support** - Requests proxied through background script
- **Detailed error reporting** - Clear error messages with suggestions
- **Response viewer** - See status, headers, and body of replay response

<!-- TODO: Add request replay screenshot -->
<img width="1203" height="891" alt="image" src="https://github.com/user-attachments/assets/fc094146-b39b-4681-a463-f16b60c09d03" />


### 🔐 JWT Token Decoder
Automatically detects and decodes JWT tokens in request headers:

- **Header & Payload** - Decoded and formatted JSON
- **Expiration status** - Visual indicator for valid/expired tokens
- **Configurable headers** - Scan `Authorization`, `X-Auth-Token`, or custom headers

<!-- TODO: Add JWT decoder screenshot -->
<img width="1203" height="891" alt="image" src="https://github.com/user-attachments/assets/211ac355-9de9-484f-96a0-cce7112c8b80" />


### 📋 Copy as JSON
Export request data for documentation or debugging:

- **Full request details** - URL, method, status, headers, body, response
- **Truncated for readability** - Large arrays limited to 5 items, strings to 10 lines
- **Compact headers** - Formatted as `["key: value"]` array
- **Formatted output** - Pretty-printed JSON ready for Slack/README


### ⚙️ Settings
Customize the extension behavior:

- **Session retention** - 1 hour, 6 hours, 12 hours, 24 hours, 48 hours, 3 days, or 1 week
- **JWT headers** - Configure which headers to scan for JWT tokens
- **Theme** - Light, dark, or system preference

<img width="837" height="891" alt="image" src="https://github.com/user-attachments/assets/7018ad4f-d85f-4ed9-8ef6-01b87a797eeb" />


---

## Installation

```bash
# Install dependencies
pnpm install
```

---

## Development

### Building the Extension

```bash
# Development build with watch mode
pnpm dev

# Production build
pnpm build
```

### Loading in Chrome (Development)

1. Run `pnpm build` to create the `dist` folder
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **"Developer mode"** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select the `dist` folder from this project
6. The extension is now installed!

### Opening the Extension

1. Open any webpage you want to debug
2. Open Chrome DevTools (`F12` or `Cmd+Option+I` on Mac / `Ctrl+Shift+I` on Windows/Linux)
3. Look for the **"Requests Visualizer"** tab in the DevTools panel
4. Start interacting with the page to capture requests

### Reloading After Code Changes

After making code changes:

1. Run `pnpm build` (or keep `pnpm dev` running for auto-rebuild)
2. Go to `chrome://extensions`
3. Find **"Chrome Requests Visualizer"** in the list
4. Click the **refresh icon** (circular arrow) on the extension card
5. **Close and reopen DevTools** to see your changes

> **Tip:** You must close and reopen DevTools for panel changes to take effect. Simply refreshing the page won't update the DevTools panel.

### Debugging the Extension

- **DevTools for DevTools:** Right-click inside the Requests Visualizer panel → "Inspect" to open DevTools for the extension itself
- **Background script logs:** Go to `chrome://extensions` → Click "Service Worker" link under the extension
- **Console errors:** Check the DevTools console in both the page and the extension's DevTools

---

## Usage Guide

### Requests Tab

| Feature | Description |
|---------|-------------|
| **Grouped View** | Groups similar URLs together with count badges (e.g., `3x /api/users/:id`) |
| **Flat View** | Shows all requests chronologically |
| **Search** | Filter requests by URL or method |
| **Method Filter** | Show only GET, POST, PUT, PATCH, DELETE, or OPTIONS |
| **Sort Options** | Sort by newest, oldest, method, or status |
| **Request Details** | Click any request to see headers, body, response, and JWT info |
| **Copy JSON** | Export full request details as formatted JSON |
| **Replay** | Re-send any request with editable parameters |

### Sessions Tab

| Feature | Description |
|---------|-------------|
| **Domain Groups** | Requests organized by domain with total counts |
| **Page Groups** | Within each domain, grouped by page path |
| **Expandable** | Click to expand/collapse domains and pages |
| **Copy Summary** | Export domain or page requests as JSON |
| **Clear Controls** | Clear individual pages or entire domains |

### Settings Tab

| Setting | Description |
|---------|-------------|
| **Session Retention** | How long to keep request history (1 hour to 1 week) |
| **JWT Headers** | Which headers to scan for JWT tokens |
| **Theme** | Light, dark, or system preference |

---

## Publishing to Chrome Web Store

### Pre-Publish Checklist

1. **Update version** in `package.json`:
   ```json
   "version": "1.0.0"
   ```

2. **Build for production**:
   ```bash
   pnpm build
   ```

3. **Test the production build**:
   - Load the `dist` folder as unpacked extension
   - Verify all features work correctly
   - Check for console errors

4. **Create ZIP file**:
   ```bash
   cd dist
   zip -r ../request-visualizer.zip .
   ```

5. **Prepare store assets**:
   - Icon: 128x128 PNG (already in `public/icon/128.png`)
   - Screenshots: 1280x800 or 640x400 PNG/JPEG
   - Promotional images (optional): 440x280 small, 920x680 large

### Publishing Steps

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay one-time $5 developer registration fee (if not already registered)
3. Click **"New Item"**
4. Upload `request-visualizer.zip`
5. Fill in store listing:
   - **Name:** Chrome Requests Visualizer
   - **Summary:** Visualize network requests, detect N+1 patterns, decode JWTs
   - **Description:** Full description of features
   - **Category:** Developer Tools
   - **Language:** English
6. Upload screenshots and icons
7. Set **visibility** (Public/Unlisted)
8. Submit for review (usually takes 1-3 business days)

### Updating Published Extension

1. Increment version in `package.json`
2. Run `pnpm build`
3. Create new ZIP from `dist` folder
4. Go to Developer Dashboard → Your extension → "Package" tab
5. Upload new ZIP
6. Submit for review

---

## Tech Stack

### TanStack DB

This extension uses [TanStack DB](https://tanstack.com/db) for reactive client-side data management. Here are the key patterns we use:

#### Collection Definition

```typescript
import { createCollection, createLocalStoragePersister } from "@tanstack/db";

// Define schema
const requestsSchema = {
  id: "string",
  url: "string",
  method: "string",
  status: "number",
  startTime: "number",
  // ...
} as const;

// Create collection with persistence
export const requestsCollection = createCollection({
  id: "requests",
  schema: requestsSchema,
  persister: createLocalStoragePersister({ name: "requests-db" }),
});
```

#### Live Queries with Filtering

```typescript
import { useLiveQuery } from "@tanstack/react-db";
import { eq, ilike, or } from "@tanstack/db";

// Reactive filtered query - re-executes when dependencies change
const filteredResult = useLiveQuery(
  (q) => {
    let query = q.from({ req: requestsCollection });

    // Method filter - eq() for equality
    if (filters.method !== "ALL") {
      query = query.where(({ req }) => eq(req.method, filters.method));
    }

    // Search filter - ilike() for case-insensitive pattern matching
    if (filters.search) {
      query = query.where(({ req }) => 
        or(
          ilike(req.url, `%${filters.search}%`),
          ilike(req.method, `%${filters.search}%`)
        )
      );
    }

    // Sorting
    return query.orderBy(({ req }) => req.startTime, "desc");
  },
  [filters.method, filters.search] // Dependencies trigger re-execution
);
```

#### Direct Writes

```typescript
// Insert
requestsCollection.utils.writeInsert(newRequest);

// Delete
requestsCollection.utils.writeDelete(requestId);

// Update
requestsCollection.utils.writeUpdate(requestId, { status: 200 });
```

#### Available Operators

```typescript
import { eq, gt, gte, lt, lte, like, ilike, inArray, and, or, not } from "@tanstack/db";

// Equality
eq(req.id, 1)

// Comparisons
gt(req.status, 200)   // greater than
gte(req.status, 200)  // greater than or equal
lt(req.status, 400)   // less than
lte(req.status, 400)  // less than or equal

// String matching
like(req.url, "/api/%")   // case-sensitive pattern
ilike(req.url, "/api/%")  // case-insensitive pattern

// Array membership
inArray(req.method, ["GET", "POST"])

// Logical operators
and(condition1, condition2)
or(condition1, condition2)
not(condition)
```

#### Conditional Query Building

```typescript
// Chain .where() calls conditionally - each adds an AND condition
const result = useLiveQuery(
  (q) => {
    let query = q.from({ req: requestsCollection });

    if (showActive) {
      query = query.where(({ req }) => eq(req.active, true));
    }

    if (minStatus) {
      query = query.where(({ req }) => gte(req.status, minStatus));
    }

    return query.orderBy(({ req }) => req.startTime, "desc");
  },
  [showActive, minStatus]
);
```

---

## License

MIT
