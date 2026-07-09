# Architecture

Potato is a **typed, Choo-shaped** framework. One application architecture — forever.

## The type spine

> **If a rename does not fail TypeScript, the design is wrong.**  
> Refactors use **types**, not grep.

```text
State   — plain serializable model (intersect feature slices)
Events  — catalog of every intent + payload tuple
emit    — only keys of Events, correct args
on      — only keys of Events, typed handlers
view    — only emit(typed); no fetch, no set
```

```text
User intent → emit('feature:action', payload)   // typed Events
           → store / feature handler
           → patch(state)                       // set + render
           → view(state, emit) → morph DOM
```

## One way to build apps

| Do this | Not this |
|---------|----------|
| `createApp<State, Events>(…)` | `potato()` for product apps |
| `defineFeature` / `defineStore<S, E>` | Untyped `on('maybe')` |
| `patch({ … })` | Forget `emit('render')` |
| Feature folders from day 1 | God-file stores that “we’ll split later” |
| Views only `emit` | `fetch` / mutate in `onclick` |

`potato()` remains for **adapters** (SSR bridge, untyped interop). Application code uses **`createApp`**.

## Feature modules (growth without restructuring)

Day 1 and day 1000 use the **same** shape:

```text
src/
  app.ts                 # createApp + use features + routes
  state.ts               # type State = A & B
  events.ts              # type Events = AEvents & BEvents
  features/
    counter/
      state.ts
      events.ts
      feature.ts         # defineFeature({ name, state, setup })
      view.tsx           # optional pure UI
  shared/types.ts        # DTOs shared with server
```

```ts
import { createApp, defineFeature, combineState, useFeatures } from '@potato/core'

const counter = defineFeature<
  { count: number },
  { 'counter:inc': [n?: number]; 'counter:reset': [] }
>({
  name: 'counter',
  state: { count: 0 },
  setup: ({ get, patch, on }) => {
    on('counter:inc', (n) => patch({ count: get().count + (n ?? 1) }))
    on('counter:reset', () => patch({ count: 0 }))
  },
})

type State = { count: number }
type Events = { 'counter:inc': [n?: number]; 'counter:reset': [] }

const app = createApp<State, Events>({ state: combineState(counter) })
useFeatures(app, counter)

app.route('/', (state, emit) => (
  <button type="button" onclick={() => emit('counter:inc', 1)}>
    {state.count}
  </button>
))
```

**Add a feature:** new folder + intersect into `State` / `Events` + `useFeatures`.  
No new architectural concept.

## Layering

```text
┌──────────────────────────────────────┐
│  views (JSX)     emit only           │
├──────────────────────────────────────┤
│  features/*/setup  intents → patch   │
├──────────────────────────────────────┤
│  domain pure libs  (formula, rules)  │
├──────────────────────────────────────┤
│  @potato/core   createApp · morph    │
├──────────────────┬───────────────────┤
│  browser         │  ssr · live · cf  │
└──────────────────┴───────────────────┘
```

## Packages

| Need | Package |
|------|---------|
| App shell (typed) | `@potato/core` → `createApp` |
| JSX | `@potato/jsx` |
| HTTP/SSR | `@potato/ssr` |
| Live patches | `@potato/live` |
| Auth / DB / CF | `@potato/auth`, `@potato/db`, `@potato/cloudflare` |
| Formulas / virtual lists | `@potato/formula`, `@potato/virtual` |

### Install weight

Default `pnpm install` keeps the tree lean: optional Cloudflare/Wrangler is **out of the workspace**, optional DB drivers are not auto-installed, Tailwind is shared at the root. See [Getting started](./getting-started.md#keeping-installs-lean).

## Effects (no Cmd required)

TypeScript is not pure. We **do not** use an Elm `Cmd` algebra as the product model.

Rules:

1. Views never perform I/O.
2. Handlers may `async` / `fetch`.
3. Prefer **result events** for async completion (`sheet:window-got`) when races matter.
4. Guard stale responses (`if (get().editing !== key) return`).

That keeps Potato simple while remaining testable and clear.

## What about TEA / Elm?

See [architecture-tea.md](./architecture-tea.md) — **optional research / advanced**, **not** the product path.  
Potato’s product architecture is **typed Choo + features**.

## Interactivity (agents: read this)

SSR serializes **HTML**, not functions. After SSR:

- `onclick={() => emit(...)}` does **nothing** in the browser unless a **client** mounts Potato.
- `liveClick` only works with a **Live client + WebSocket hub**.

Working patterns live under `examples/` (see `examples/README.md`).

## Success metrics

1. Green `tsc` ⇒ every `emit` / `on` / state access agrees with `State` + `Events`.
2. Rename an event key ⇒ only the TypeScript error list to fix (no grep hunt).
3. Adding a feature never introduces a second style.
4. Agents learn one page: **state · Events · emit · feature · view · (client or Live for clicks)**.
5. Interactive demos never ship SSR-only buttons.
