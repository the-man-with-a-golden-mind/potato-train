# Potato documentation

Start here if you are new:

1. **[Getting started](./getting-started.md)** — monorepo install, first SPA/SSR  
2. **[Install from npm](./install-npm.md)** — apps outside the monorepo  
3. **[Architecture](./architecture.md)** — the one product path (types + features)  
4. **[Interactivity](./interactivity.md)** — why buttons need a client or Live  
5. **[API reference](./api.md)** — package surfaces  

| Guide | Description |
|-------|-------------|
| [Getting started](./getting-started.md) | Monorepo install, lean deps, first apps, Tailwind |
| [Install from npm](./install-npm.md) | Scaffold / `pnpm add potato-train-*` for real apps |
| [Architecture](./architecture.md) | Type spine: State + Events + features |
| [Interactivity](./interactivity.md) | SPA · client bundle · Live + WebSocket |
| [Troubleshooting](./troubleshooting.md) | Dead buttons, ports, install, TS, Live, CORS |
| [Debugger](./debug.md) | Timeline, state diffs, panel, `__POTATO__` |
| [API reference](./api.md) | Core, SSR, Live, Auth, DB, Formula |
| [Testing](./testing.md) | Vitest, honest coverage, e2e |
| [Performance](./performance.md) | Benchmarks & virtual lists |
| [Tutorial: Spreadsheet](./tutorials/spreadsheet.md) | Virtual grid + formulas |
| [Tutorial: Trello](./tutorials/trello.md) | Boards + Live session state |
| [TEA notes](./architecture-tea.md) | Advanced only — **not** the product path |
| [Release](./RELEASE.md) | How to publish packages |
| [Changelog](../CHANGELOG.md) | What shipped |

## Agent rules

Root **[llms.txt](../llms.txt)** points models at the right files.  
Root **[AGENTS.md](../AGENTS.md)** is the short law for humans and AI:

- `createApp` only for apps  
- `defineFeature` + `patch`  
- Views pure (client emit / SSR emit no-op)  
- Live: `onEvent` → `session.state` only  
- Refactors via `tsc`

## Examples

Index: **[examples/README.md](../examples/README.md)** (each folder has its own README).

```bash
pnpm build
pnpm dev:spa            # SPA + Tailwind
pnpm dev:ssr            # SSR + auth + Live
pnpm dev:sheet          # spreadsheet (port 3010)
pnpm dev:portfolio      # portfolio (port 3020)
pnpm dev:trello         # Live Trello (port 3030)
# cloudflare: cd examples/cloudflare && pnpm install && pnpm dev
```

## Quality

```bash
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm ci
```
