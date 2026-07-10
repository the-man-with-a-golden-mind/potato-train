# Testing & coverage

## Commands

| Command | What |
|---------|------|
| `pnpm test` | Vitest unit suite (from monorepo root) |
| `pnpm test:coverage` | Unit + coverage report + **honest** thresholds |
| `pnpm test:e2e` | Playwright (browser + spawned example servers) |
| `pnpm test:all` | coverage + e2e |
| `pnpm test:bench` | Performance benches |
| `pnpm --filter potato-train-core test` | One package (uses root vitest config) |

Per-package scripts call `scripts/test-package.mjs` so they run from the monorepo
root with the shared config (package-local `vitest --dir tests` does **not** match
root-oriented `include` globs).

## Coverage (honest gate)

Configured in `vitest.config.ts`:

- **Provider:** `@vitest/coverage-v8`
- **Thresholds:** 70% lines / statements / functions, 55% branches  
  (not a fake 100% achieved by excluding critical code)
- **Included (critical runtime):**  
  `app`, `router`, `morph`, `store`, `emitter`, SSR `server`/`context`, Live client/server, auth, formula, jsx, virtual, etc.
- **Excluded only when not default CI surface:**
  - optional peer drivers: `postgres.ts`, `sqlite.ts`, `d1.ts`
  - meta re-exports / CLI: `packages/potato/**`, `create-potato/**`
  - type-only modules
  - `morph-html.ts` — large HTML-string morph; covered by Live e2e + unit samples

Open `coverage/index.html` after `pnpm test:coverage`. Treat the report as a map of
risk, not a vanity 100% badge.

## Playwright e2e

| Spec | Covers |
|------|--------|
| `e2e/core-ssr.spec.ts` | SSR document + API |
| `e2e/coverage-apps.spec.ts` | Auth login, formula PATCH, SPA render, **spawned** ssr/sheet/portfolio/trello examples |

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

## Product rules under test

| Rule | Where enforced |
|------|----------------|
| Views pure during SSR | `toString` / `toVNode` pass a no-op `emit` |
| Live mutates `session.state` | `createLiveHub` **requires** `onEvent` (no `app.emitter` fallback) |
| SSR request isolation | `isolateState` + no merge from global `app.state` |

## CI

`.github/workflows/ci.yml` runs `test:coverage` then `test:e2e`.
