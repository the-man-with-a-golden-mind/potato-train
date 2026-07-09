# Install from npm

Use this when you **are not** developing inside the Potato monorepo.  
Packages are published as `@potato/*` and `create-potato` (see [CHANGELOG](../CHANGELOG.md)).

> If packages are not on the registry yet, use the [monorepo](./getting-started.md) or `pnpm link` / workspace path overrides.

## Prerequisites

- Node **20+**
- **pnpm**, npm, or bun

## Option A — Scaffold (recommended)

```bash
# after create-potato is published
pnpm create potato my-app
# or: npm create potato@latest my-app
# or: pnpm create potato my-app --template=ssr

cd my-app
pnpm install
pnpm dev
```

| Template | Stack |
|----------|--------|
| `spa` (default) | Vite + Tailwind + `createApp` + features |
| `ssr` | Node server + Live WebSocket + Tailwind |

## Option B — Manual SPA

```bash
mkdir my-app && cd my-app
pnpm init
pnpm add @potato/core @potato/jsx @potato/debug
pnpm add -D vite typescript @potato/vite-plugin @tailwindcss/vite tailwindcss
```

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

```ts
// src/main.tsx
import './styles.css'
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
app.route('/', (s, emit) => (
  <button type="button" onclick={() => emit('counter:inc', 1)}>{s.count}</button>
))
app.mount('#app')
```

```json
// tsconfig.json (jsx)
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@potato/jsx",
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022",
    "strict": true
  }
}
```

## Option C — Manual SSR

```bash
pnpm add @potato/core @potato/jsx @potato/ssr @potato/live
pnpm add -D typescript tsx @types/node
# for Live on Node, also: pnpm add ws && pnpm add -D @types/ws
```

```ts
import { createApp, asRawApp } from '@potato/core'
import { createServer, logger } from '@potato/ssr'

type State = { title: string }
type Events = Record<string, never>

const app = createApp<State, Events>({ state: { title: 'Hello' } })
app.route('/', (s) => <h1>{s.title}</h1>)

const server = createServer({
  app: asRawApp(app),
  middleware: [logger()],
})
await server.listen(3000)
```

For **clickable** SSR UIs, see [Interactivity](./interactivity.md) (client bundle or Live + WebSocket).

## Optional packages

| Package | Install when you need… |
|---------|-------------------------|
| `@potato/auth` | Sessions / login |
| `@potato/db` | Drizzle helpers — also `pnpm add drizzle-orm` (peer) |
| `@potato/db` + SQLite | `pnpm add better-sqlite3` (optional peer) |
| `@potato/db` + Postgres | `pnpm add postgres` (optional peer) |
| `@potato/live` | LiveView-style patches |
| `@potato/cloudflare` | Workers adapter |
| `@potato/formula` | Spreadsheet formulas |
| `@potato/virtual` | Virtual list windows |
| `@potato/debug` | Devtools |

```bash
pnpm add @potato/auth @potato/live
pnpm add drizzle-orm          # if using @potato/db
pnpm add better-sqlite3       # only if using sqlite adapter
```

## Versioning

Align major/minor across `@potato/*` for a given release (e.g. all `0.1.x`).  
See [CHANGELOG](../CHANGELOG.md).

## Next

- [Getting started (monorepo)](./getting-started.md)  
- [Architecture](./architecture.md)  
- [Interactivity](./interactivity.md)  
- [Troubleshooting](./troubleshooting.md)  
