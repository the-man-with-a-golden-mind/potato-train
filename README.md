# Potato 🚂

**A typed, Choo-shaped TypeScript framework** — small API, events + state + views, built for humans and AI agents.

| | |
|---|---|
| **SPA** | Client-only apps (Vite) |
| **SSR** | Pages, API routes, middleware |
| **Live** | Phoenix LiveView-style server UI |
| **JSX** | First-class (`@potato/jsx`) |
| **Auth / DB / CF** | Sessions, Drizzle, Workers — optional packages |

---

## Architecture in one sentence

> **`createApp<State, Events>` + features + `patch` + views that only `emit`.**  
> Refactors use **TypeScript**, not grep.

```ts
import { createApp, defineFeature, combineState, useFeatures } from '@potato/core'

type State = { count: number }
type Events = { 'counter:inc': [n?: number] }

const counter = defineFeature<State, Events>({
  name: 'counter',
  state: { count: 0 },
  setup: ({ get, patch, on }) => {
    on('counter:inc', (n) => patch({ count: get().count + (n ?? 1) }))
  },
})

const app = createApp<State, Events>({ state: combineState(counter) })
useFeatures(app, counter)

app.route('/', (state, emit) => (
  <button type="button" onclick={() => emit('counter:inc', 1)}>
    {state.count}
  </button>
))

app.mount('#app')
```

Full rules: **[docs/architecture.md](./docs/architecture.md)** · Agents: **[llms.txt](./llms.txt)** · **[AGENTS.md](./AGENTS.md)**

---

## Quick start (monorepo)

Install from the **repo root** only:

```bash
pnpm install
pnpm build
```

```bash
pnpm dev:spa          # Vite SPA + Tailwind
pnpm dev:ssr          # SSR + auth API
pnpm dev:sheet        # 50k-row spreadsheet
pnpm dev:portfolio
pnpm dev:trello       # multiplayer Live board
```

### Scaffold a new app

```bash
pnpm --filter create-potato build
pnpm create potato my-app                 # SPA
pnpm create potato my-app --template=ssr  # SSR
```

### Lean installs

Default workspace **excludes** Cloudflare (Wrangler ~150MB+).  
Optional DB drivers are **not** auto-installed.

| Need | Command |
|------|---------|
| Cloudflare demo | `cd examples/cloudflare && pnpm install && pnpm dev` |
| SQLite driver | `pnpm add better-sqlite3` in your app |
| E2E browsers | `pnpm exec playwright install chromium` |

Details: [Getting started](./docs/getting-started.md#keeping-installs-lean)

---

## Packages

| Package | Role |
|---------|------|
| `@potato/core` | **`createApp`**, features, router, morph |
| `@potato/jsx` | JSX runtime |
| `@potato/html` | HTML tagged templates |
| `@potato/ssr` | `createServer`, middleware, document shell |
| `@potato/live` | LiveView hub + client |
| `@potato/auth` | Sessions + password hashing |
| `@potato/db` | Drizzle helpers (postgres / sqlite / d1) |
| `@potato/cloudflare` | Workers + WebSocket Live |
| `@potato/formula` | Spreadsheet formulas |
| `@potato/virtual` | Virtual list windows |
| `@potato/debug` | Devtools |
| `@potato/vite-plugin` | Vite defaults for SPA |
| `create-potato` | App scaffold CLI |

> Unscoped name `potato` is taken on npm — import `@potato/core` (and friends) directly.

**Release:** [docs/RELEASE.md](./docs/RELEASE.md) · `pnpm release` (needs npm + GitHub auth)

---

## SPA (Vite + Tailwind)

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { potato } from '@potato/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [potato(), tailwindcss()],
})
```

```css
/* src/styles.css */
@import "tailwindcss";
```

Runnable: `pnpm dev:spa` → `examples/spa`

---

## SSR + API

```ts
import { createApp, asRawApp } from '@potato/core'
import { createServer, logger, cors } from '@potato/ssr'

type State = { title: string }
type Events = Record<string, never>

const app = createApp<State, Events>({ state: { title: 'Hello' } })
app.route('/', (state) => <h1>{state.title}</h1>)

const server = createServer({
  app: asRawApp(app),
  middleware: [logger(), cors()],
})
server.get('/api/health', () => ({ ok: true }))
await server.listen(3000)
```

Auth, Effect handlers, Live, DB, and Cloudflare: see [docs/api.md](./docs/api.md).

---

## Examples

See **[examples/README.md](./examples/README.md)** for an overview; each example has its own README.

| Command | What |
|---------|------|
| `pnpm dev:spa` | Typed SPA + Tailwind + devtools |
| `pnpm dev:ssr` | SSR + Live todos + auth API |
| `pnpm dev:sheet` | Virtual 50k-row spreadsheet + formulas |
| `pnpm dev:portfolio` | Dashboard + ticks |
| `pnpm dev:trello` | Multiplayer Live Trello |
| `pnpm dev:cf` | Cloudflare (install that example first) |

---

## Tests

```bash
pnpm test             # unit
pnpm test:coverage    # unit + coverage gate
pnpm test:e2e         # Playwright
pnpm test:all         # coverage + e2e
pnpm test:bench
pnpm size
pnpm ci               # build + coverage + e2e + size
```

---

## Documentation

| Doc | Contents |
|-----|----------|
| [Getting started](./docs/getting-started.md) | Monorepo install, first app, Tailwind |
| [Install from npm](./docs/install-npm.md) | Scaffold / use packages outside monorepo |
| [Architecture](./docs/architecture.md) | **Product law** — type spine + features |
| [Interactivity](./docs/interactivity.md) | SPA · client bundle · Live + WebSocket |
| [Troubleshooting](./docs/troubleshooting.md) | Dead buttons, ports, install, Live |
| [API reference](./docs/api.md) | Packages and APIs |
| [CHANGELOG](./CHANGELOG.md) | Release notes |
| [RELEASE](./docs/RELEASE.md) | How to publish |
| [Tutorial: Spreadsheet](./docs/tutorials/spreadsheet.md) | Virtual grid + formulas |
| [Tutorial: Trello](./docs/tutorials/trello.md) | Boards / Live |
| [TEA notes](./docs/architecture-tea.md) | Advanced only — not the default |
| [Performance](./docs/performance.md) | Benches & virtual lists |
| [All docs](./docs/README.md) | Index |

---

## Philosophy

> Programming should be fun and light. Small APIs win.

One architecture from day 1. Optional carriages (SSR, Live, DB, CF) when you need them.

---

## License

MIT
