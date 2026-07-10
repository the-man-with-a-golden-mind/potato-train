# API reference

Product apps use **`createApp` + `defineFeature`**.  
Low-level `potato()` is for adapters only.

## `potato-train-core` — product API

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
| **`patch(partial)`** | Merge state **and** emit `render` (preferred for UI) |
| `set(partial)` | Silent merge — **no** re-render (batching only) |
| `update(fn)` | Mutate draft in place, then emit `render` |
| `get()` | Current state |
| `on(event, fn)` | Typed listener |
| `emit(event, …)` | Typed emit |

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
  throwOnHandlerError?: boolean  // default: true in dev / when debug
})
```

### `toString` / pure render

`app.toString(location, partial?)` and `toVNode` use an **isolated snapshot** and a **no-op `emit`**.  
Views must not rely on side effects during SSR / Live HTML generation.

### `h` / JSX

```tsx
/** @jsxImportSource potato-train-jsx */
<button type="button" onclick={() => emit('counter:inc', 1)}>{state.count}</button>
```

### Built-in events

`render`, `navigate`, `pushState`, `replaceState`, `popState`, `DOMTitleChange`, `live:patch`, `live:event`, `error`, `trace`, …

Always available on typed `emit` via `WithFrameworkEvents<E>`.

---

## `potato-train-debug`

```ts
import { devtools } from 'potato-train-debug'
app.use(devtools()) // panel + window.__POTATO__ + state diffs
```

| Feature | |
|---------|--|
| Event timeline | Every `emit` with args |
| State diffs | What changed after each event |
| Render timing | ms between paints |
| UI panel | **Ctrl+Shift+P** |
| API | `window.__POTATO__` |

Full guide: [debug.md](./debug.md).

---

## `potato-train-ssr`

### `createServer({ app, middleware, document, live, clientEntry })`

```ts
import { asRawApp } from 'potato-train-core'
import { createServer, logger, cors } from 'potato-train-ssr'

const server = createServer({
  app: asRawApp(app), // or app.raw
  middleware: [
    logger(),
    // Secure default: same-origin only. Cross-origin needs an allowlist:
    cors({ origin: ['https://app.example.com'] }),
    // cors({ origin: '*' }), // public APIs only — not with credentials
  ],
})
server.get/post/put/patch/delete(path, handler)
server.page(path, loader) // request-local state patch for SSR
server.fetch(Request)
server.listen(port)
```

Request context (`ctx.state`) is **isolated** from the shared `app.state` for concurrent safety.

### `cors(options?)`

| Option | Default | Notes |
|--------|---------|--------|
| `origin` | same-origin only | String, string[], or `(origin) => boolean`. Does **not** reflect arbitrary origins. |
| `credentials` | off | Incompatible with `origin: '*'` |
| `methods` / `headers` | sensible REST defaults | Override as needed |

---

## `potato-train-live`

### View helpers

`liveClick(event, payload?)`, `liveSubmit(event)`, `liveChange(event)` — same names as your `Events` map.  
These serialize intents into data attributes (functions are not sent to the browser).

### `createLiveHub({ app, onEvent, sharedState?, broadcast? })`

**`onEvent` is required.** Production model:

```ts
createLiveHub({
  app,
  sharedState: (topic) => ({ /* multiplayer bag for topic */ }),
  onEvent: (event, payload, session) => {
    // ✅ Mutate session.state only
    const s = session.state as { count: number }
    if (event === 'inc') s.count += 1
  },
})
```

| Rule | |
|------|--|
| Mutate | `session.state` (+ topic shared via hub) |
| Do **not** | `app.emitter.emit` or `Object.assign(app.state, …)` |
| Render | Pure `app.toString(href, session.state)` → HTML patch |

Client: `connectLive` from `potato-train-live/client` (or live-boot).  
See [Interactivity](./interactivity.md).

---

## `potato-train-virtual` / `potato-train-formula`

Virtual window math and spreadsheet formulas — pure domain libs, no UI coupling.

---

See [Architecture](./architecture.md) for the product law (type spine + features).
