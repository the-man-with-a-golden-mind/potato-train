# Spreadsheet example

Excel-like **virtual spreadsheet**: 50k rows, formulas, sticky headers, raw-value editing.

Tutorial: [docs/tutorials/spreadsheet.md](../../docs/tutorials/spreadsheet.md)

## Run

From monorepo root:

```bash
pnpm install && pnpm build
pnpm dev:sheet
```

Open **http://localhost:3010** (hard-refresh if the client bundle was rebuilt).

## UX

| Action | How |
|--------|-----|
| Select | Click a cell — formula bar shows **raw** value |
| Edit | Double-click, **F2**, or start typing |
| Save | **Enter** (move down) / **Tab** (move right) |
| Cancel | **Esc** |
| Navigate | Arrow keys (when not editing) |
| Clear | **Del** / **Backspace** |
| Resize | Drag column header edge |
| Scroll | Full 50k rows; headers stay sticky |

## Architecture

```text
src/
  app.tsx              # createApp + route
  client.tsx           # browser mount
  server.ts            # APIs + esbuild client + Tailwind inject
  sheet-store.ts       # server formula engine
  styles.css           # Tailwind + grid CSS
  sheet/
    types.ts           # SheetState + SheetEvents
    feature.ts         # defineFeature — all client logic
    view.tsx           # emit only
    api.ts             # fetch window / cell / patch
```

Type spine: rename `sheet:edit-start` in `SheetEvents` → fix `tsc` sites only.

## API

```http
GET   /api/health
GET   /api/sheets/demo
GET   /api/sheets/demo/window?rowStart=0&rowCount=40&colStart=0&colCount=12
GET   /api/sheets/demo/cells/D2
PATCH /api/sheets/demo/cells/B2   { "value": "99" }
PUT   /api/sheets/demo/cells      { "cells": { "B2": "99" } }
```

Formulas: `=B2*C2`, `=SUM(D2:D4)`, `=IF(…)`, via `@potato/formula`.
