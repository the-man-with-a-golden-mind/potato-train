# Interactivity — SPA, client bundles, and Live

**Critical rule:** server-rendered HTML does **not** run TypeScript `onclick` handlers.  
Those functions exist only while rendering on the server (or in a browser bundle). They are **not** attributes in the HTML string.

If buttons do nothing after load, you almost always forgot a **client** or a **Live WebSocket**.

---

## Choose a pattern

| Goal | Pattern | Example |
|------|---------|---------|
| Client-only app | **SPA mount** | `examples/spa` |
| SSR shell + rich UI | **Client bundle** mounts Potato | `examples/spreadsheet`, `examples/portfolio` |
| Multiplayer / server-driven clicks | **Live** (`liveClick` + WS + client) | `examples/trello`, `examples/ssr` |
| Cloudflare Live | **Live** + `potatoWorker` + boot script | `examples/cloudflare` |

---

## 1. SPA (Vite)

Browser owns the app. Handlers work because `emit` runs in the same JS that mounted the app.

```ts
// src/main.tsx
const app = createApp<State, Events>({ state: … })
useFeatures(app, …)
app.route('/', (state, emit) => (
  <button type="button" onclick={() => emit('counter:inc', 1)}>+1</button>
))
app.mount('#app')
```

No separate Live stack required.

---

## 2. Client bundle (SSR + interactive)

**Server** sends HTML shell (and optional first paint).  
**Browser** loads `/assets/client.js`, creates the app, and mounts.

```text
Browser request
  → SSR HTML (pretty, SEO, first paint)
  → <script type="module" src="/assets/client.js">
  → client: createApp + mount(#app)
  → onclick / emit work
```

Typical setup (see spreadsheet / portfolio):

1. `src/client.tsx` — mount Potato on `#app`
2. Bundle with the monorepo helper:

```ts
import {
  bundleClient,
  exampleRootFromSrc,
  mountClientAssets,
} from '../_shared/bundle-client.js'

const exampleRoot = exampleRootFromSrc(import.meta.url)
await bundleClient({
  entry: join(exampleRoot, 'src/client.tsx'),
  exampleRoot,
  label: 'my-app',
  packages: ['core', 'jsx'], // + 'live' for Live clients
})
// …
mountClientAssets(server, exampleRoot)
// document: { clientEntry: '/assets/client.js' }
```

3. `createServer({ document: { clientEntry: '/assets/client.js' } })`

```ts
// client.tsx
import { createBrowserApp } from './app.js'
const el = document.getElementById('app')!
createBrowserApp().mount(el)
```

Views can use `onclick={() => emit('…')}` **in the client app**.  
If the same view is also SSR’d, prefer Live for server-owned state, or accept that SSR HTML is replaced on mount.

---

## 3. Live (server-driven UI)

Clicks go to the server over WebSocket; the server returns HTML **patches** (morph).

### View (SSR-safe)

Use data attributes, not function handlers:

```ts
import { liveClick, liveSubmit } from '@potato/live'

<button type="button" {...liveClick('todo:toggle', id)}>
  Toggle
</button>

<form {...liveSubmit('card:add')}>
  <input name="title" />
  <button type="submit">Add</button>
</form>
```

Event names must match your typed `Events` / hub `onEvent`.

### Server

1. `createLiveHub({ app, onEvent, sharedState?, broadcast? })`
2. WebSocket upgrade on `/__potato/live` (Node: `ws` + `http` upgrade; CF: `potatoWorker({ live })`)
3. On event: update domain/state, then hub pushes `ok` / `patch` HTML

### Browser

Something must **join** the socket and morph `#app`:

```ts
// bundled client
import { connectLive } from '@potato/live/client'

connectLive({
  url: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/__potato/live`,
  topic: 'board', // same topic as hub
  root: '#app',
})
```

Or use the monorepo helper for an inline script (no bundler):

```ts
import { liveBootScript } from '../_shared/live-boot.js'
// document.scripts: [liveBootScript({ topic: 'page' })]
```

`connectLive` **queues** messages until the socket is open so early clicks are not lost.

### Full Live stack (checklist)

- [ ] View uses `liveClick` / `liveSubmit` (not bare `onclick`)
- [ ] Hub `onEvent` updates state / domain
- [ ] WebSocket server accepts `/__potato/live`
- [ ] Browser runs `connectLive` or live-boot
- [ ] Topic names match on client and server

---

## 4. What does **not** work

```ts
// SSR-only page, no clientEntry, no Live
app.route('/', (s, emit) => (
  <button onclick={() => emit('inc')}>+1</button>  // dead in the browser
))
```

```ts
// liveClick without WebSocket + client
<button {...liveClick('inc')}>+1</button>
// HTML has data-potato-click, but nothing listens → dead
```

---

## Quick decision tree

```text
Is this a Vite SPA?
  yes → mount in main.tsx
  no  → Do you need multiplayer / server-owned UI?
          yes → Live (liveClick + hub + WS + connectLive)
          no  → Client bundle that mounts Potato
```

---

## Examples to copy

| Example | Pattern |
|---------|---------|
| `examples/spa` | SPA mount |
| `examples/spreadsheet` | Client bundle |
| `examples/portfolio` | Client bundle + REST |
| `examples/trello` | Live multiplayer |
| `examples/ssr` | Live todos + auth API |
| `examples/cloudflare` | Live on Workers |

See also [Troubleshooting](./troubleshooting.md).
