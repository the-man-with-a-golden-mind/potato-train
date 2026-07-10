# Changelog

All notable changes to Potato packages are documented here.

## [0.3.0] — 2026-07-10

### Multiplayer Saper (Minesweeper)
- Real-time multiplayer canvas with virtualized $1000\times1000$ grid rendering.
- Proof-of-work join validation, flag validation (difficulty 3), and revive validation (difficulty 5).
- Client-side ticking digital display and viewport synchronizers.
- Dynamic overscan cell rendering.

## [0.2.2] — 2026-07-10

### `create-potato`

- **Fix:** scaffolded apps pin `packageManager: pnpm@10.11.1` so a Corepack-managed `pnpm install` resolves a known-good version instead of whatever Corepack falls back to outside a pinned project
- **Fix:** SSR template lists `@parcel/watcher` and `esbuild` under `trustedDependencies` so `bun install` doesn't silently block their native postinstall scripts (declaring `trustedDependencies` at all replaces Bun's default allow-list, so both had to be listed explicitly)
- **Fix:** the CLI e2e harness and Vitest integration test now copy `package.json` into the simulated `node_modules` install, not just `dist/` and `templates/` — omitting it made Node treat the staged ESM `cli.js` as CommonJS and crash on the top-level `import`
- Root `build` script runs package builds with `--workspace-concurrency=1` and a one-time retry, working around a rare upstream `tsup`/TypeScript race (`TS5055`) that could otherwise fail `pnpm build` intermittently

### Release tooling

- **Fix:** `scripts/release.mjs` no longer keys every publish/skip/tag decision off one hardcoded `VERSION` constant. Each package now publishes against its own `package.json` version, so an independent patch (like this `create-potato` bump) is no longer silently skipped because the constant still said `0.2.0`.
- `workspace:*` dependency ranges are rewritten to each dependency's real current version (read live) instead of the old shared constant.
- `github`/`all` accept an optional version argument; `all` defaults the git tag to the single package it just published when only one changed, otherwise falls back to the root `package.json` version.

## [0.2.1] — 2026-07-10

### `create-potato`

- **Fix:** template copy no longer skips files when the package lives under `node_modules` (broke `pnpm create potato … --template=ssr`)
- Works with **npm**, **pnpm**, and **bun** create flows; docs use `--` for npm/pnpm flags
- Scaffolded SSR scripts use portable `npm run css` (works under npm/pnpm/bun)
- Detect package manager for post-scaffold install/dev hints
- Integration tests simulate a real `node_modules` install path

## [0.2.0] — 2026-07-10

Safety-focused release for the first public package set.

### Runtime safety

- **SSR request isolation** — route rendering now uses isolated state snapshots instead of mutating shared `app.state`.
- **Live session safety** — Live renders from session-local state and serializes the fallback emitter path with save/restore.
- **Emitter strict mode** — handler errors can fail fast through `throwOnHandlerError`.
- **Store updates** — `update(fn)` now re-renders like `patch`, while `set` remains the explicit silent write.
- **DOM morph** — removed keys from object-style props are cleared instead of leaving stale inline styles.
- **CORS** — default behavior is same-origin only; credentialed wildcard responses are prevented.

### Release and tooling

- Package and scaffold dependencies bumped to `0.2.0`.
- Release script publishes workspace dependencies as `^0.2.0`.
- Coverage thresholds now include core runtime modules instead of excluding them behind a false 100% gate.
- `.pnpm-store/` is ignored.

## [0.1.0] — 2026-07-09

First public release of the monorepo (package names: **`potato-train-*`**).

### Runtime safety (pre-release)

- **SSR request isolation** — `isolateState` / pure `toString` (no shared `app.state` bleed)
- **Pure views on SSR** — `emit` is a no-op during HTML render (render-local cache)
- **Live** — `onEvent` **required**; mutate **`session.state` only** (no global emitter fallback)
- **Store** — `patch` / `update` re-render; `set` is silent
- **CORS** — same-origin default (no reflect-any-origin)
- **DOM morph** — clears removed object-style keys
- **Coverage** — honest thresholds; critical modules included

### Polish (pre-release)

- Shared `examples/_shared/bundle-client.ts` for esbuild client entries
- `llms.txt` + docs for agents (architecture, interactivity, troubleshooting)
- E2E: interactive ssr / portfolio / trello UI tests
- Per-package `pnpm --filter potato-train-core test` via `scripts/test-package.mjs`

### Architecture (product)

- **One app path:** `createApp<State, Events>` — typed intents end-to-end
- **Features:** `defineFeature`, `combineState`, `useFeatures`, `app.useFeature`
- **`patch(partial)`** on stores — set state and re-render in one call
- Views are **pure UI**; client `emit`s intents; Live uses `onEvent(session)`
- Refactors driven by **TypeScript**, not string grep
- TEA / Elm path documented as **optional research**, not the default

### Packages published to npm

| Package | Highlights |
|---------|------------|
| `potato-train-core` | App, features, router, morph, typed events |
| `potato-train-jsx` | Automatic JSX runtime |
| `potato-train-html` | Tagged templates |
| `potato-train-ssr` | `createServer`, middleware, document shell |
| `potato-train-live` | LiveView hub + browser client |
| `potato-train-auth` | Sessions + password hashing |
| `potato-train-db` | Drizzle helpers; drivers as optional peers |
| `potato-train-cloudflare` | Workers + WebSocket Live |
| `potato-train-formula` | Spreadsheet formulas + dirty graph |
| `potato-train-virtual` | Virtual window math |
| `potato-train-debug` | Devtools |
| `potato-train-vite-plugin` | Vite SPA defaults |
| `create-potato` | Scaffold **spa** / **ssr** templates |

> Unscoped npm name `potato` is already taken. The monorepo meta package stays **private** — import `potato-train-core` (etc.) directly.

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
