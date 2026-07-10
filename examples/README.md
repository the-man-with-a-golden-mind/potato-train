# Potato examples

Runnable demos for the **product architecture**:

> `createApp<State, Events>` · `defineFeature` · `patch` · pure views · Live `onEvent(session.state)`

Install from the **monorepo root** first:

```bash
cd potato-train
pnpm install
pnpm build
```

| Example | Command | Default URL | How clicks work | Status |
|---------|---------|-------------|-----------------|--------|
| [spa](./spa) | `pnpm dev:spa` | :5173 | Vite mounts Potato | ✅ Verified |
| [ssr](./ssr) | `pnpm dev:ssr` | :3000 | Live WS + `onEvent` → `session.state` | ✅ Verified |
| [spreadsheet](./spreadsheet) | `pnpm dev:sheet` | :3010 | client.js mounts app | ✅ Verified |
| [portfolio](./portfolio) | `pnpm dev:portfolio` | :3020 | client.js + REST | ✅ Verified |
| [trello](./trello) | `pnpm dev:trello` | :3030 | Live multiplayer `session.state` | ✅ Verified |
| [cloudflare](./cloudflare) | see README | Wrangler | Live WS + session-local `onEvent` | ⚠️ Optional install |

**Rules:**

1. SSR HTML alone cannot run `onclick` — need a **client bundle** or **Live WebSocket + client**.
2. Live: **`onEvent` required**; mutate **`session.state` only** (never `app.emitter` / `app.state`).
3. During SSR / Live HTML, **`emit` is a no-op** — views stay pure.

Shared helpers:

- [`_shared/bundle-client.ts`](./_shared/bundle-client.ts) — esbuild → `dist/client.js` + asset routes  
- [`_shared/load-tailwind.ts`](./_shared/load-tailwind.ts) — Tailwind for Node servers  
- [`_shared/live-boot.ts`](./_shared/live-boot.ts) — inline Live client (Cloudflare)

Agent pack: monorepo root [`llms.txt`](../llms.txt) + [`AGENTS.md`](../AGENTS.md).

Also: **create-potato** scaffolds `spa` / `ssr` under `packages/create-potato/templates/` (ssr includes Live + WS + session-local `onEvent`).

Docs: [architecture](../docs/architecture.md) · [interactivity](../docs/interactivity.md) · [AGENTS.md](../AGENTS.md)
