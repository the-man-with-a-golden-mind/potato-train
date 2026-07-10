# Troubleshooting

## Install & monorepo

### `Workspace dependency "potato-train-core" not found`

You ran install **inside** `examples/…`. Always:

```bash
cd potato-train   # monorepo root
pnpm install
pnpm build
```

### Cloudflare / Wrangler not found

Cloudflare is **not** in the default workspace (large download).

```bash
pnpm install && pnpm build   # root first
cd examples/cloudflare
pnpm install
pnpm dev
```

### Optional DB drivers missing

`better-sqlite3` and `postgres` are **optional peers** (not auto-installed):

```bash
pnpm add better-sqlite3   # sqlite adapter
pnpm add postgres         # postgres adapter
pnpm add drizzle-orm      # required peer of potato-train-db
```

### Install is huge again

Default lean install excludes Cloudflare and optional peers.  
See [Getting started — lean installs](./getting-started.md#keeping-installs-lean).

---

## Buttons / UI do nothing

### After SSR, clicks are dead

**Cause:** `onclick={() => emit(...)}` is not sent to the browser as JS.

**Fix:** add a **client bundle** that mounts the app, **or** use **Live** (`liveClick` + WebSocket + `connectLive`).  
Full guide: [Interactivity](./interactivity.md).

### Live buttons have `data-potato-click` but still dead

Check:

1. Browser loaded a Live client (`connectLive` or live-boot script in the page).
2. WebSocket connects (DevTools → Network → WS → `/__potato/live`).
3. Server handles **upgrade** (Node `ws` + `httpServer.on('upgrade')`, or `potatoWorker` on CF).
4. Hub `topic` matches the client topic.

### Stale client after code change

Hard-refresh: **Ctrl+Shift+R** (or clear cache).  
Client routes should use `cache-control: no-store` (examples do). Restart `pnpm dev` / `pnpm start` so esbuild rebuilds `dist/client.js`.

### “Simulate tick” / refresh no-op (portfolio-style)

Usually no client bundle or fetch errors. Open DevTools → Network for `/api/…` and Console for errors. Status line should show *Tick applied* / *Error: …*.

---

## Ports & servers

| Example | Default port |
|---------|----------------|
| spa (Vite) | 5173 |
| ssr | 3000 |
| spreadsheet | 3010 |
| portfolio | 3020 |
| trello | 3030 |

### `EADDRINUSE: port already in use`

```bash
# Linux
fuser -k 3020/tcp
# or
PORT=3021 pnpm start
```

### Health checks

```bash
curl -s http://127.0.0.1:3010/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3010/assets/client.js
```

Interactive Node demos should return **200** for `/assets/client.js` (except pure SPA Vite).

---

## TypeScript

### `emit('typo')` / wrong payload

Good — types are working. Fix `Events` or the call site.  
Do **not** use `as any` / `as never` on emit.

### `createApp` expected 0 type arguments

Name clash: your file exports `function createApp` and also imports `createApp` from core.

```ts
import { createApp as createTypedApp } from 'potato-train-core'
export function createApp() {
  const app = createTypedApp<State, Events>(…)
  return app.raw
}
```

### JSX types / wrong runtime

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "potato-train-jsx"
  }
}
```

Vite: `potato-train-vite-plugin` or set `esbuild.jsxImportSource` to `potato-train-jsx`.

---

## Live / WebSocket

### `createLiveHub requires onEvent`

`onEvent` is **required**. There is no `app.emitter` fallback.

```ts
createLiveHub({
  app,
  onEvent: (event, payload, session) => {
    // mutate session.state only
  },
})
```

### Cross-session state weirdness / races

Do **not** do this in Live:

```ts
Object.assign(app.state, session.state)
app.emitter.emit(event, payload)
```

Mutate **`session.state` only**. Multiplayer: use `sharedState` + hub broadcast.

### WS connects then closes immediately

- Path must match (`/__potato/live`).
- Upgrade handler must call `hub.handleMessage` on each message.
- Don’t run two processes on the same port.

### Events lost on first click

Use current `potato-train-live` `connectLive` (queues until open) or live-boot with a queue. Rebuild packages after pull: `pnpm build`.

### Morph looks wrong after patch

Ensure patches replace **view HTML** inside `#app`, not a full document. Hub uses pure `app.toString(href, session.state)`.

### `emit` during SSR does nothing / warn in console

**Expected.** During `toString` / SSR / Live HTML render, `emit` is a **no-op** (views must be pure).  
Put side effects in stores, page loaders, Live `onEvent`, or client-mounted handlers.

---

## CORS

### Browser blocks API from another origin

`cors()` default is **same-origin only** (does not reflect arbitrary `Origin` headers).

```ts
cors({ origin: ['https://app.example.com'] })
// or public APIs:
cors({ origin: '*' }) // never combine with credentials: true
```

---

## Tailwind

### Styles missing on SSR examples

CSS is built on server start via `load-tailwind` / `pnpm css`.  
If you only changed classes, restart the server so CLI rebuilds `dist/styles.css`.

### Vite SPA has no utilities

- `import './styles.css'` with `@import "tailwindcss"`
- Vite plugin: `tailwindcss()` from `@tailwindcss/vite`

---

## Scaffold (`create-potato`)

```bash
# Prefer @latest (0.2.1+ fixes template copy under node_modules)
npm create potato@latest my-app -- --template=ssr
pnpm create potato my-app -- --template=ssr
bun create potato my-app --template=ssr
```

### `Template missing: …/templates/ssr` (or empty app)

**Cause (create-potato &lt; 0.2.1):** copy filter treated any path containing the substring `node_modules` as skippable. When the CLI ran from `node_modules/create-potato/…`, the whole template was skipped.

**Fix:** use **create-potato@0.2.1+**, or scaffold from the monorepo:

```bash
pnpm --filter create-potato build
node packages/create-potato/dist/cli.js my-app --template=ssr
```

### Flags ignored with pnpm/npm

Pass CLI flags after `--`:

```bash
pnpm create potato my-app -- --template=ssr
npm create potato@latest my-app -- --ssr
```

Scaffolded apps depend on **published** `potato-train-*` versions.  
Until publish, point `package.json` at the monorepo with `workspace:` / `link:` or develop inside `examples/`.

---

## Still stuck?

1. Confirm pattern in [Interactivity](./interactivity.md).  
2. Copy the closest [example](../examples/README.md).  
3. Check browser Console + Network (and WS frames for Live).  
4. Product rules: [Architecture](./architecture.md) · [AGENTS.md](../AGENTS.md).
