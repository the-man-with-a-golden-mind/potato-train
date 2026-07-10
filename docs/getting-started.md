# Getting started

## Prerequisites

- **Node 20+**
- **pnpm 9+** (recommended)

## 1. Install the monorepo

**Always install from the repo root** — not from `examples/*`.

```bash
git clone <this-repo>
cd potato-train
pnpm install
pnpm build
```

### Keeping installs lean

| Need | Install |
|------|---------|
| Default demos (SPA, SSR, sheet, portfolio, trello) | `pnpm install` at root |
| Cloudflare example | `cd examples/cloudflare && pnpm install` |
| SQLite for `potato-train-db/sqlite` | app: `pnpm add better-sqlite3` |
| Postgres driver | app: `pnpm add postgres` |
| E2E browsers | `pnpm exec playwright install chromium` |

Cloudflare is **out of the default workspace** (Wrangler is large).  
Optional DB drivers are **not** auto-installed.

### Bun

```bash
cd potato-train   # monorepo root
bun install
bun run build
```

### Run examples

```bash
pnpm dev:spa          # http://localhost:5173 (Vite)
pnpm dev:ssr
pnpm dev:sheet        # http://localhost:3010
pnpm dev:portfolio    # http://localhost:3020
pnpm dev:trello       # http://localhost:3030
```

## 2. Your first SPA (typed from day 1)

Or scaffold:

```bash
pnpm --filter create-potato build
pnpm create potato my-app
cd my-app && pnpm install && pnpm dev
```

### Hand-written minimal app

```ts
import { createApp, defineFeature, combineState, useFeatures } from 'potato-train-core'

type State = { count: number }
type Events = {
  'counter:inc': [n?: number]
  'counter:reset': []
}

const counter = defineFeature<State, Events>({
  name: 'counter',
  state: { count: 0 },
  setup: ({ get, patch, on }) => {
    on('counter:inc', (n) => patch({ count: get().count + (n ?? 1) }))
    on('counter:reset', () => patch({ count: 0 }))
  },
})

const app = createApp<State, Events>({ state: combineState(counter) })
useFeatures(app, counter)

app.route('/', (state, emit) => (
  <main>
    <p>{state.count}</p>
    <button type="button" onclick={() => emit('counter:inc', 1)}>+1</button>
    <button type="button" onclick={() => emit('counter:reset')}>reset</button>
  </main>
))

app.mount('#app')
```

**Why this shape?**

- `Events` makes typos a **compile error**
- `patch` updates state and re-renders
- Views only `emit` — logic stays in the feature

With Vite + **Tailwind CSS v4**:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { potato } from 'potato-train-vite-plugin'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [potato(), tailwindcss()],
})
```

```css
/* src/styles.css */
@import "tailwindcss";
```

```ts
// main.tsx
import './styles.css'
```

SSR / server examples use `@tailwindcss/cli` via `examples/_shared/load-tailwind.ts` (inject compiled CSS into `documentHtml`).

```bash
pnpm dev:spa
```

## 3. Growing the app

Add a feature folder; intersect types:

```ts
type State = CounterState & TodosState
type Events = CounterEvents & TodosEvents

const app = createApp<State, Events>({
  state: combineState(counter, todos),
})
useFeatures(app, counter, todos)
```

Same architecture as day 1 — more features, not a new style.

## 4. Your first SSR server

```ts
import { createApp, defineFeature, asRawApp } from 'potato-train-core'
import { createServer, logger } from 'potato-train-ssr'

type State = { title: string }
type Events = Record<string, never>

const app = createApp<State, Events>({ state: { title: 'Hello SSR' } })
app.route('/', (s) => <h1>{s.title}</h1>)

const server = createServer({
  app: asRawApp(app),
  middleware: [logger()],
})
await server.listen(3000)
```

## 5. Next

| Doc | Why |
|-----|-----|
| [Install from npm](./install-npm.md) | Use Potato outside this monorepo |
| [Architecture](./architecture.md) | Product law (one path) |
| [Interactivity](./interactivity.md) | Client bundles & Live (buttons that work) |
| [Troubleshooting](./troubleshooting.md) | Dead clicks, ports, install issues |
| [API](./api.md) | Package details |
| [Spreadsheet tutorial](./tutorials/spreadsheet.md) | Virtual grid + formulas |
| [Trello tutorial](./tutorials/trello.md) | Live multiplayer pattern |
