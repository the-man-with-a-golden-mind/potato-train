# Cloudflare example

Potato on **Cloudflare Workers** with Live-style clicks.

> **Not in the default monorepo workspace** — Wrangler/Workerd is large (~150MB+).  
> Install this example separately.

## Install & run

From monorepo root (packages must already be built):

```bash
pnpm install && pnpm build   # at monorepo root first
cd examples/cloudflare
pnpm install
pnpm dev
```

`pnpm dev` runs Tailwind → `src/tw-inline.js`, then `wrangler dev`.

Deploy:

```bash
pnpm deploy
```

## What it shows

| Piece | Role |
|--------|------|
| `createApp` + `defineFeature` | Typed counter |
| `potato-train-ssr` + `potato-train-cloudflare` | Worker `fetch` + Live WebSocket upgrade |
| Tailwind | Inlined CSS string for the Worker bundle |
| `liveClick('inc')` | Marks the button for Live |
| Hub `onEvent` | Mutates **`session.state` only** (see `worker.tsx`) |
| Inline Live boot | `examples/_shared/live-boot.ts` — joins WS and morphs patches |

Without the Live boot script, buttons would be dead (same class of bug as old portfolio/trello).  
Live handlers must not call `app.emitter` or mutate global `app.state`.

## Layout

```text
src/worker.tsx       # app + potatoWorker export
src/styles.css       # Tailwind entry
src/tw-inline.js     # generated CSS export (do not hand-edit)
scripts/build-css.mjs
wrangler.toml
```

## Notes

- Rebuild CSS with `pnpm css` if you change classes without full `dev`.
- DB optional: wire D1 via `potato-train-db/d1` when `env.DB` is set.
- Health: `GET /api/health`
