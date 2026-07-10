# Tutorial: Virtual spreadsheet

Walkthrough of `examples/spreadsheet` — 50k-row virtual grid, formula DSL, Excel-like UI, backend field updates.

## Run

```bash
# from monorepo root
pnpm install   # or bun install
pnpm build
pnpm dev:sheet
# open http://localhost:3010
```

### Interactive UI (important)

The sheet is a **client-mounted** Potato app (`/assets/client.js`), not static SSR HTML.

| Action | How |
|--------|-----|
| **Select** | Click a cell — formula bar shows **raw** value |
| **Edit** | Double-click, or **F2**, or start typing |
| **Save** | **Enter** (move down) or **Tab** (move right) |
| **Cancel** | **Esc** |
| **Navigate** | Arrow keys (when not editing) |
| **Clear** | **Delete** / **Backspace** on selection |
| **Scroll** | Scroll the grid — headers stay frozen (sticky) |
| **Resize** | Drag the right edge of a column header |

Data API works without the UI: `PATCH /api/sheets/demo/cells/B2`.

## Feature layout

```
examples/spreadsheet/src/
  app.tsx              # createApp + route (typed)
  client.tsx           # browser mount (createSheetApp)
  server.ts            # HTTP + esbuild client + Tailwind CSS inject
  styles.css           # Tailwind + Excel grid custom CSS
  sheet-store.ts       # server formula engine + seed data
  sheet/
    types.ts           # SheetState + SheetEvents (type spine)
    feature.ts         # defineFeature — all client logic
    constants.ts       # row height, overscan, …
    api.ts             # fetch window / cell / patch
    helpers.ts         # col width, moveKey, focusEditor
    view.tsx           # pure JSX — emit only (+ Tailwind utilities)
```

| Package | Role |
|---------|------|
| `potato-train-formula` | `=SUM(A1:A3)`, `IF`, refs, dirty graph |
| `potato-train-virtual` | `computeWindow` for scroll windows |
| `potato-train-core` | `createApp`, `defineFeature`, morph |
| `potato-train-jsx` | JSX → VNodes |

## API surface

```http
GET  /api/sheets/demo
GET  /api/sheets/demo/window?rowStart=0&rowCount=40&colStart=0&colCount=12
GET  /api/sheets/demo/cells/D2
PATCH /api/sheets/demo/cells/B2
     { "value": "99" }
PUT  /api/sheets/demo/cells
     { "cells": { "B2": "99", "C2": "4.5" } }
```

## Formula examples

```
=B2*C2
=SUM(D2:D4)
=IF(D6>100,"Big order","Small")
=D6*0.08
```

## Virtualization

```
scrollTop, viewportH, rowHeight
→ start = floor(scrollTop / rowHeight) - overscan
→ end = start + visible + 2*overscan
→ canvas height = totalRows * rowHeight (+ sticky header)
→ only render rows [start, end)
```

Sticky column headers + row numbers use CSS `position: sticky` inside one scroll container (Excel-like frozen panes without dual-scroll sync bugs).

## Field update flow

1. Click cell → `sheet:select` (formula bar = raw)
2. Double-click / F2 → `sheet:edit-start`
3. Type → `sheet:edit-change`
4. Enter → `sheet:edit-commit` → `PATCH /cells/:key`
5. Server `setCell` → formula recompute
6. Client reloads window → `emit('render')`

## Architecture notes

This example follows the **product type spine**:

- `SheetState` + `SheetEvents` — every intent is typed (`createApp`)
- `defineFeature` in `sheet/feature.ts` — handlers use `patch` / `set`
- View is pure UI — client `emit`s intents (see `sheet/view.tsx`); no I/O in the view
- Server domain (`sheet-store.ts` + `potato-train-formula`) stays pure of UI
- Clicks work via **client bundle** (`client.js` mounts Potato), not bare SSR handlers

Rename `sheet:edit-start` in `SheetEvents` → TypeScript lists every call site. No grep.

## Stretch goals

- WebSocket live co-editing (`potato-train-live`): `onEvent` mutates **`session.state` only** + `sharedState` for multiplayer (see [trello tutorial](./trello.md) and [interactivity](../interactivity.md))
- Persist raw cells in D1 / Postgres
- Virtual columns (horizontal windowing)
