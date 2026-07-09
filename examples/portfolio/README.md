# Portfolio example

Dashboard demo: holdings, sector allocation, P&amp;L, simulated price ticks.

## Run

From monorepo root:

```bash
pnpm install && pnpm build
pnpm dev:portfolio
```

Open **http://localhost:3020**.

## What it shows

| Piece | Role |
|--------|------|
| `createApp` + `defineFeature` | Typed dashboard events |
| **Client bundle** | Buttons run in the browser (`dist/client.js`) |
| `dash:tick` / `dash:refresh` | POST/GET API → `patch` UI |
| Tailwind | UI utilities |
| REST | Tick + portfolio JSON |

> SSR alone cannot run `onclick` handlers. This example mounts a client app
> (same pattern as the spreadsheet).

## API

```http
GET  /api/health
GET  /api/portfolio
POST /api/portfolio/tick
PATCH /api/portfolio/holdings/:symbol
```

## Layout

```text
src/app.tsx      # feature + view
src/data.ts      # in-memory portfolio + ticks
src/server.ts    # createServer + APIs
src/styles.css
```

UI emits `dash:refresh` / `dash:loaded`; the feature owns `patch`.
