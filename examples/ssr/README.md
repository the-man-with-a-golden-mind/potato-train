# SSR example

Server-rendered Potato app with **auth API**, **Live-style events**, and **Tailwind**.

## Run

From monorepo root:

```bash
pnpm install && pnpm build
pnpm dev:ssr
```

Open `http://localhost:3000` (or `PORT` you set).

## What it shows

| Piece | Role |
|--------|------|
| `createApp` + `defineFeature` | Typed todos state / events |
| `asRawApp` / `.raw` | Bridge to `createServer` |
| `@potato/ssr` | HTTP + HTML document shell |
| `@potato/auth` | Login demo (`demo@potato.dev` / `potato`) |
| `@potato/live` | `liveClick` + `connectLive` client |
| WebSocket hub | `/__potato/live` — required for button clicks |
| Client bundle | `/assets/client.js` |
| Tailwind | Built at server start via `_shared/load-tailwind` |

## API

```http
GET  /api/health
POST /api/login   { "email": "demo@potato.dev", "password": "potato" }
GET  /api/me
```

## Layout

```text
src/app.tsx       # createApp + feature + routes
src/server.ts     # createServer + auth + Live hub
src/styles.css    # Tailwind entry
```

## Notes

- Tailwind CSS is compiled on boot (CLI from monorepo root tooling).
- Full multiplayer Live WebSocket wiring is shown more completely in the [trello](../trello) example.
