# Trello Agent Context

A Chrome DevTools extension that watches **Trello-related network traffic** for the inspected tab and builds a **list of cards** with optional **lane (list) filtering** and **one-click export** as Markdown or JSON. It is meant for copying structured card context into other tools while using your normal Trello session in the browser.

[screenshot](image.png)

## Requirements

- **Chromium-based browser** (Chrome, Edge, Brave, etc.) with extension support.
- **DevTools open on the Trello tab** you care about. The panel reads the same network log DevTools uses; it does not inject into the page.
- You must be **logged into Trello** and load a **board** (and optionally open cards) so the app issues the API calls this extension understands.

## What gets captured

Only requests whose URL host is one of:

- `trello.com` or `*.trello.com`
- `api.trello.com`

Everything else is ignored (for example `as.atlassian.com`, analytics, or third-party power-ups).

Resource types: **XHR**, **fetch**, and **document** responses, same as the underlying DevTools hook.

## Features

### Board bulk list (no need to open each card)

When Trello loads the board, it usually fetches a large payload of **visible cards** and **open lists**. The extension parses responses such as:

- `GET /1/board/{shortLinkOrId}?…&cards=visible&lists=open&operationName=quickload:CurrentBoardListsCards`
- `POST /gateway/api/graphql?operationName=quickload:TrelloCurrentBoardListsCards` (GraphQL shape: flat `lists`/`cards`, nested lists with `cards`, or a bounded deep search for matching objects)

Each card is stored with at least **id**, **name**, **idList** (lane), and common fields when present (**shortLink**, **shortUrl**, **desc**, etc.).

### Richer data when you open a card

Additional responses are merged into the same card record, for example:

- `POST /1/cards/{id}/markAsViewed` — marks which card was last focused in the UI.
- `GET /1/card/{shortLink}?…&operationName=quickload:PreloadCard` — full card payload (description, attachments, checklist ids, etc.).
- `GET /1/checklist/{id}?…` — checklist names and items.
- `GET https://api.trello.com/1/cards/{id}/checklists?…` — checklist bundles from the REST host.

### Lane filter

**Lists** (lanes) come from the board bulk payload. The sidebar **Lane** control filters the card list by `idList`. **All lanes** shows every captured card.

### Export

For the selected card:

- **Copy Markdown** — human-readable sections (title, link, lane, description, checklists, attachments, image URLs) plus a trailing fenced JSON block.
- **Copy JSON** — structured object suitable for tools and scripts.

### Storage limits

The **gear** button opens **Capture storage**: retention window, max rows per URL pattern, and max total rows. Older rows are dropped when limits are exceeded (same storage mechanism as the original request visualizer fork).

## UI overview

| Area | Purpose |
|------|---------|
| Header | Title, Trello request count, card count, clear capture, storage settings, theme |
| Lane | Select list to filter cards |
| Cards | Detected cards (newest activity first); subtitle shows lane name when known |
| Detail | Fields, checklists, links, Markdown preview, copy actions |

## Installation and development

```bash
npm install
npm run build
```

Load **unpacked**:

1. Open `chrome://extensions` (or equivalent).
2. Enable **Developer mode**.
3. **Load unpacked** → choose the **`dist`** directory produced by the build.

Open the panel:

1. Navigate to a Trello board in a normal tab.
2. Open **Developer Tools**.
3. Find the **Trello Agent Context** DevTools panel (created next to Application, Network, etc.).

After code changes: run `npm run build`, reload the extension on `chrome://extensions`, then **close and reopen DevTools** so the panel picks up the new bundle.

## Project layout (high level)

| Path | Role |
|------|------|
| `src/devtools/App.tsx` | Wires capture, settings, and main view |
| `src/hooks/useNetworkCapture.ts` | DevTools network listener + Trello URL filter |
| `src/hooks/useTrelloSnapshot.ts` | Applies parsers to new captured requests |
| `src/lib/trello/parseTrelloRequest.ts` | URL/body → structured events |
| `src/lib/trello/aggregate.ts` | Merges events into cards, lanes, checklists |
| `src/lib/trello/isTrelloUrl.ts` | Host allowlist for capture |
| `src/components/TrelloAppView.tsx` | Card list, lane filter, detail, copy |
| `src/components/TrelloCaptureSettings.tsx` | Storage limits sheet |
| `src/manifest.json` | Extension name, description, devtools page |

## Privacy and security

- Processing is **local** to your browser; the extension does not send captured data to a custom backend.
- You are still subject to **Trello’s terms** and your workspace policies. This tool only reorganizes responses your browser already received.
- Exported Markdown/JSON may contain **links or text from cards**; treat exports like any other copy of workspace data.

## Limitations

- If the **board bulk** request was **garbage-collected** or never fired (e.g. narrow retention), the card list may only contain cards you **opened** or touched.
- **Checklist item text** from the board bulk request may be minimal depending on Trello’s `card_checklist_checkItems` settings on that call; opening the card often loads full checklist rows.
- **Atlassian batch** endpoints (`as.atlassian.com/api/v1/batch`) are **not** on the Trello host allowlist and are not used.

## License

MIT
