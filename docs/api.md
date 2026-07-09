# API reference

Product apps use **`createApp` + `defineFeature`**.  
Low-level `potato()` is for adapters only.

## `@potato/core` — product API

### `createApp<State, Events>(opts?)` ⭐ required for apps

Compile-time safe app. **Typos in event names and wrong payloads fail `tsc`.**

```ts
type State = { count: number }
type Events = { 'counter:inc': [n?: number]; 'counter:reset': [] }

const app = createApp<State, Events>({ state: { count: 0 } })
```

| Method | Description |
|--------|-------------|
| `use(store)` | Register a store |
| `useFeature(feature)` | Register `defineFeature(…).store` |
| `route(path, view)` | `:param` typed on `state.params` |
| `mount(selector)` | Start + mount in browser |
| `emit` / `state` | Typed emit and state |
| `toString` / `toVNode` | SSR |
| `raw` / `asRawApp(app)` | Untyped `PotatoApp` for SSR adapters |

### `defineFeature({ name, state, setup })` ⭐ preferred unit

```ts
const counter = defineFeature<
  { count: number },
  { 'counter:inc': [n?: number] }
>({
  name: 'counter',
  state: { count: 0 },
  setup: ({ get, patch, on }) => {
    on('counter:inc', (n) => patch({ count: get().count + (n ?? 1) }))
  },
})

type State = InferFeatureState<typeof counter>
type Events = InferFeatureEvents<typeof counter>
```

### `combineState(...features)` / `useFeatures(app, ...features)`

```ts
const app = createApp<State, Events>({ state: combineState(a, b) })
useFeatures(app, a, b)
```

### `defineStore<State, Events>(name, initial, setup)`

Lower-level than `defineFeature` (same typing). Prefer features for new code.

### Store API (`setup` callback)

| Method | Description |
|--------|-------------|
| **`patch(partial)`** | Set state **and** re-render (preferred) |
| `set(partial)` | Set state without render |
| `get()` | Current state |
| `on(event, fn)` | Typed listener |
| `emit(event, …)` | Typed emit |
| `update(fn)` | Mutate draft in place |

### `PrefixEvents<'sheet', { select: [key: string] }>`

Type helper → `{ 'sheet:select': [key: string] }`.

### `eventName('sheet', 'select')` → `'sheet:select'`

### `potato(opts?)` (low-level / untyped)

For adapters and legacy. **Do not use as the product app entry.**

```ts
potato({
  history?: boolean
  href?: boolean
  hash?: boolean
  cache?: number
  initialState?: object
  debug?: boolean
})
```

### `h` / JSX

```tsx
/** @jsxImportSource @potato/jsx */
<button type="button" onclick={() => emit('counter:inc', 1)}>{state.count}</button>
```

### Built-in events

`render`, `navigate`, `pushState`, `replaceState`, `popState`, `DOMTitleChange`, `live:patch`, `live:event`, `error`, `trace`, …

Always available on typed `emit` via `WithFrameworkEvents<E>`.

---

## `@potato/ssr`

### `createServer({ app, middleware, document, live, clientEntry })`

```ts
import { asRawApp } from '@potato/core'

const server = createServer({
  app: asRawApp(app), // or app.raw
  middleware: [logger()],
})
server.get/post/put/patch/delete(path, handler)
server.fetch(Request)
server.listen(port)
```

---

## `@potato/live`

`liveClick(event, payload?)`, `liveSubmit(event)`, hub for multiplayer morph patches.  
Use the **same** event names as your `Events` map.

---

## `@potato/virtual` / `@potato/formula`

Virtual window math and spreadsheet formulas — pure domain libs, no UI coupling.

---

See [Architecture](./architecture.md) for the product law (type spine + features).
