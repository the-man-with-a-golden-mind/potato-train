# Testing & coverage

## Commands

| Command | What |
|---------|------|
| `pnpm test` | Vitest unit suite |
| `pnpm test:coverage` | Unit + **100%** statements/branches/functions/lines on gated modules |
| `pnpm test:e2e` | Playwright (browser + spawned example servers) |
| `pnpm test:all` | coverage + e2e |
| `pnpm test:bench` | Performance benches |

## Coverage gate (100%)

Configured in `vitest.config.ts`:

- **Provider:** `@vitest/coverage-v8`
- **Thresholds:** 100% lines, statements, functions, branches
- **Included:** core (typed surface), ssr (document/effect/router), formula graph/refs, jsx, virtual, db (d1 helpers), live protocol, vite-plugin
- **Excluded from gate (still unit-tested):**
  - `morph.ts` / `morph-html.ts` — large real-DOM engines (tested in `morph*.test.ts` + e2e)
  - `app.ts` / `cache.ts` / full live client-server / auth / cloudflare / html parser / formula engine body — extensive unit tests, residual branch edges
  - optional peer drivers `postgres.ts` / `sqlite.ts`
  - re-export meta package, CLI, type-only files

Open `coverage/index.html` after `pnpm test:coverage`.

## Playwright e2e

| Spec | Covers |
|------|--------|
| `e2e/core-ssr.spec.ts` | SSR document + API |
| `e2e/coverage-apps.spec.ts` | Auth login, formula PATCH, SPA render, **spawned** ssr/sheet/portfolio/trello examples |

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

## CI

`.github/workflows/ci.yml` runs `test:coverage` then `test:e2e`.
