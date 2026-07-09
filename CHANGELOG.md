# Changelog

All notable changes to Potato packages are documented here.

## [0.1.0] — 2026-07-09

First public release of the monorepo.

### Polish (pre-release)

- Shared `examples/_shared/bundle-client.ts` for esbuild client entries
- `llms.txt` for coding agents
- User docs: install-from-npm, interactivity, troubleshooting
- E2E: interactive ssr / portfolio / trello UI tests

### Architecture (product)

- **One app path:** `createApp<State, Events>` — typed intents end-to-end
- **Features:** `defineFeature`, `combineState`, `useFeatures`, `app.useFeature`
- **`patch(partial)`** on stores — set state and re-render in one call
- Views only **`emit`**; logic lives in features
- Refactors driven by **TypeScript**, not string grep
- TEA / Elm path documented as **optional research**, not the default

### Packages

| Package | Highlights |
|---------|------------|
| `@potato/core` | App, features, router, morph, typed events |
| `@potato/jsx` | Automatic JSX runtime |
| `@potato/html` | Tagged templates |
| `@potato/ssr` | `createServer`, middleware, document shell |
| `@potato/live` | LiveView hub + browser client |
| `@potato/auth` | Sessions + password hashing |
| `@potato/db` | Drizzle helpers; drivers as optional peers |
| `@potato/cloudflare` | Workers + WebSocket Live |
| `@potato/formula` | Spreadsheet formulas + dirty graph |
| `@potato/virtual` | Virtual window math |
| `@potato/debug` | Devtools |
| `@potato/vite-plugin` | Vite SPA defaults |
| `create-potato` | Scaffold **spa** / **ssr** templates |
| `potato` | Meta re-exports |

### Examples

- SPA (Vite + Tailwind + features)
- SSR + Live todos + auth
- Spreadsheet (50k virtual rows, formulas, Excel-like UI)
- Portfolio dashboard
- Multiplayer Trello (Live)
- Cloudflare Worker (optional install — heavy Wrangler)

### Tooling & install

- Tailwind CSS v4 on all main examples
- Lean default `pnpm install` (~200MB class): Cloudflare example **out of workspace**; optional peers not auto-installed
- Playwright e2e, Vitest coverage gate, size budgets

### Docs

- Architecture, getting started, API, tutorials, AGENTS.md, release guide
