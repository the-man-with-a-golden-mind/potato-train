# Potato — agent rules

You are building with **Potato**, a tiny typed Choo-shaped TypeScript framework.

## The type spine (non-negotiable)

Application code is fully described by:

1. **`State`** — plain serializable object (feature slices intersected)
2. **`Events`** — map of event name → payload tuple
3. **`emit(event, …)`** — only keys of `Events` (compile error otherwise)
4. **`defineFeature` / `defineStore`** — handlers use `on` + **`patch`**
5. **`view(state, emit)`** — pure UI; **emit only on the client**. During SSR/`toString`, `emit` is a **no-op** (views must not rely on side effects while rendering).
6. **`createServer`** — optional SSR + HTTP APIs. Request state is isolated; never treat `app.state` as per-request.
7. **Live** — `createLiveHub({ onEvent })` is **required**. Mutate **`session.state` only** (plus topic `sharedState`). Do not call `app.emitter` / mutate `app.state` in Live handlers.

**Refactors use TypeScript, not grep.** If renaming an event does not fail `tsc`, the app is not typed correctly.

## The only app entry

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
  <button type="button" onclick={() => emit('counter:inc', 1)}>
    {state.count}
  </button>
))

app.mount('#app')
```

### Forbidden in application code

- `potato()` as the app entry (use `createApp`; `potato` is for low-level adapters)
- Untyped `emit('stringly')` / missing `Events` generic
- Business logic or `fetch` in views
- `as any` / `as never` on state or emit
- Inventing a second architecture (hooks, Redux, TEA-as-default)

## Feature layout (day 1 = forever)

```text
features/<name>/
  state.ts      // export type XState = { … }
  events.ts     // export type XEvents = { 'x:action': […] }
  feature.ts    // defineFeature({ name, state, setup })
  view.tsx      // optional; emit only
```

App:

```ts
type State = CounterState & BoardState
type Events = CounterEvents & BoardEvents
```

## Store API

| Method | Use |
|--------|-----|
| `patch(partial)` | **Preferred** — set state + re-render |
| `set(partial)` | Silent state update (rare; batching) |
| `get()` | Read current state |
| `on(event, handler)` | Typed listener |
| `emit(event, …)` | Typed emit (including `render` if needed) |

## Naming

- Events: `feature:action` — e.g. `sheet:edit-start`, `todo:add`
- Prefer one feature owns its event prefix

## Server

```ts
import { asRawApp } from 'potato-train-core'
const server = createServer({ app: asRawApp(app) })
// or createServer({ app: app.raw })
```

## Interactivity (critical — footgun)

**SSR HTML alone cannot run `onclick`.** Function handlers are not serialized to the browser.

| Kind of app | What you must ship |
|-------------|--------------------|
| SPA (Vite) | `app.mount('#app')` in the client entry |
| Interactive SSR dashboard | Client bundle (`/assets/client.js`) that mounts Potato |
| Live / multiplayer | `liveClick` / `liveSubmit` **and** a Live client (`connectLive` or live-boot) **and** a WebSocket server |

```ts
// ❌ Dead buttons after SSR — handlers never reach the browser
<button onclick={() => emit('save')}>Save</button>

// ✅ Live pattern
<button type="button" {...liveClick('save', id)}>Save</button>
// + connectLive({ url: 'ws://…/__potato/live', topic: '…' })
// + createLiveHub({ app, onEvent }) — onEvent mutates session.state only
// + WS upgrade on the server
```

During SSR / Live HTML (`toString`), **`emit` is a no-op** — views stay pure.

Reference working examples: `examples/spreadsheet` (client mount), `examples/trello` / `examples/ssr` / `examples/cloudflare` (Live + session state), `examples/spa` (Vite mount).

## Live / multiplayer

1. View: `liveClick('feature:action', payload)` / `liveSubmit('…')` — same names as `Events`
2. Server: `createLiveHub({ app, onEvent, sharedState? })` — **`onEvent` required**; mutate **`session.state` only**
3. Browser: `connectLive` from `potato-train-live/client` (or `examples/_shared/live-boot.ts`)

```ts
// ❌ Never in Live handlers
app.emitter.emit(event, payload)
Object.assign(app.state, session.state)
```

## Huge lists

Use `potato-train-virtual` + window APIs (see spreadsheet example).

## Docs

| Doc | Use |
|-----|-----|
| [Architecture](./docs/architecture.md) | Product law |
| [Getting started](./docs/getting-started.md) | Monorepo install + first app |
| [Install from npm](./docs/install-npm.md) | Outside monorepo |
| [Interactivity](./docs/interactivity.md) | Client / Live (required for clicks) |
| [Troubleshooting](./docs/troubleshooting.md) | Common failures |
| [API](./docs/api.md) | Package reference |
| [docs/README.md](./docs/README.md) | Full index |
| TEA notes | Advanced only — **not** default |

## Debugger

```ts
import { devtools } from 'potato-train-debug'
app.use(devtools()) // Ctrl+Shift+P · window.__POTATO__ · state diffs
```

See [docs/debug.md](./docs/debug.md).

## Scaffold

```bash
pnpm --filter create-potato build

# Any package manager (flags after -- for npm/pnpm):
npm create potato@latest my-app -- --template=ssr
pnpm create potato my-app -- --template=ssr
bun create potato my-app --template=ssr

# From monorepo without publishing:
node packages/create-potato/dist/cli.js my-app --template=ssr
```
