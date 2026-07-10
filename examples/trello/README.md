# Trello example

**Multiplayer Live board** — lists, cards, moves, shared state over WebSocket.

Tutorial pattern: [docs/tutorials/trello.md](../../docs/tutorials/trello.md)

## Run

From monorepo root:

```bash
pnpm install && pnpm build
pnpm dev:trello
```

Open **http://localhost:3030** in **two windows** to see Live updates.

## What it shows

| Piece | Role |
|--------|------|
| `createApp` + `defineFeature` | Board state + typed events |
| `potato-train-live` | `liveClick` / `liveSubmit` + `connectLive` client |
| Live hub + WebSocket | `onEvent` + `session.state` + topic `sharedState`; morph HTML patches |
| Client bundle | `/assets/client.js` (required for buttons) |
| Tailwind | Board UI |

## Events (same names client ↔ server)

- `card:add` — form submit  
- `card:move` — move card between lists  
- `board:sync` — refresh board in store  

## Layout

```text
src/app.tsx      # typed app + board view
src/board.ts     # domain: lists/cards mutations
src/server.ts    # HTTP + WebSocket Live + Tailwind
src/styles.css
```

## Tips

- Peer count is in the header pill.
- Domain logic stays in `board.ts` (pure of DOM); the hub calls it on Live events.
