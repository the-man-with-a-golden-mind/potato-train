# Potato examples

Runnable demos for the **product architecture**:

> `createApp<State, Events>` · `defineFeature` · `patch` · views only `emit`

Install from the **monorepo root** first:

```bash
cd potato-train
pnpm install
pnpm build
```

| Example | Command | Default URL | How clicks work | Status |
|---------|---------|-------------|-----------------|--------|
| [spa](./spa) | `pnpm dev:spa` | :5173 | Vite mounts Potato | ✅ Verified |
| [ssr](./ssr) | `pnpm dev:ssr` | :3000 | Live WS + client.js | ✅ Verified |
| [spreadsheet](./spreadsheet) | `pnpm dev:sheet` | :3010 | client.js mounts app | ✅ Verified |
| [portfolio](./portfolio) | `pnpm dev:portfolio` | :3020 | client.js + REST | ✅ Verified |
| [trello](./trello) | `pnpm dev:trello` | :3030 | Live WS + client.js | ✅ Verified |
| [cloudflare](./cloudflare) | see README | Wrangler | Live WS + inline boot | ⚠️ Optional install |

**Rule:** SSR HTML alone cannot run `onclick`. Interactive demos need either a **client bundle** or **Live WebSocket + client**.

Shared helpers:

- [`_shared/bundle-client.ts`](./_shared/bundle-client.ts) — esbuild → `dist/client.js` + asset routes  
- [`_shared/load-tailwind.ts`](./_shared/load-tailwind.ts) — Tailwind for Node servers  
- [`_shared/live-boot.ts`](./_shared/live-boot.ts) — inline Live client (Cloudflare)

Agent pack: monorepo root [`llms.txt`](../llms.txt) + [`AGENTS.md`](../AGENTS.md).

Also: **create-potato** scaffolds `spa` / `ssr` under `packages/create-potato/templates/` (ssr includes Live + WS).

Architecture docs: [../docs/architecture.md](../docs/architecture.md) · [../AGENTS.md](../AGENTS.md)
