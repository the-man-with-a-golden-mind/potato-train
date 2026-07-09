# Performance

## Running benchmarks

```bash
pnpm test:bench
```

Included benches (`packages/core/tests/perf.bench.ts`):

- `renderToString` for 1k and 10k row tables  
- Router match among 200 routes  
- SSR with 2k-cell store + virtual 50-cell view  

## Rules of thumb

| Scenario | Approach |
|----------|----------|
| &lt; 200 DOM nodes | Full re-render is fine |
| 1k–100k rows | **Virtual window** (see spreadsheet) |
| Heavy formulas | Recompute sheet on server; send window only |
| Live multiplayer | PATCH single fields; debounce |
| SSR HTML size | Don’t serialize entire 50k grid — only state needed to hydrate |

## Virtual tables (pattern)

```ts
// 1. totalRows = 50_000, rowHeight = 28
// 2. on scroll → compute start/end indices
// 3. GET /api/sheets/:id/window?rowStart=&rowCount=
// 4. Render only those <tr>s inside a tall spacer div
```

DOM cost stays O(viewport), network cost O(window), formula cost O(dirty cells).

## Measuring in the browser

```ts
import { devtools } from '@potato/debug'
app.use(devtools())
// console shows render timings when debug logging is on
```

## Formula engine

`@potato/formula` is intentionally small (recursive descent, no dependency graph optimisations yet). For huge interdependent sheets:

1. Evaluate only dirty cells (future work)  
2. Or pre-aggregate on the backend  

Current `evaluateSheet` memoizes per evaluation pass and detects cycles.
