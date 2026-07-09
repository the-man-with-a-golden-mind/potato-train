# Troubleshooting

## Install & monorepo

### `Workspace dependency "@potato/core" not found`

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
pnpm add drizzle-orm      # required peer of @potato/db
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
import { createApp as createTypedApp } from '@potato/core'
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
    "jsxImportSource": "@potato/jsx"
  }
}
```

Vite: `@potato/vite-plugin` or set `esbuild.jsxImportSource` to `@potato/jsx`.

---

## Live / WebSocket

### WS connects then closes immediately

- Path must match (`/__potato/live`).
- Upgrade handler must call `hub.handleMessage` on each message.
- Don’t run two processes on the same port.

### Events lost on first click

Use current `@potato/live` `connectLive` (queues until open) or live-boot with a queue. Rebuild packages after pull: `pnpm build`.

### Morph looks wrong after patch

Ensure patches replace **view HTML** inside `#app`, not a full document. Hub uses `app.toString(href, state)`.

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
pnpm --filter create-potato build
pnpm create potato my-app
pnpm create potato my-app --template=ssr
```

Scaffolded apps depend on **published** `@potato/*` versions (`^0.1.0`).  
Until publish, point `package.json` at the monorepo with `workspace:` / `link:` or develop inside `examples/`.

---

## Still stuck?

1. Confirm pattern in [Interactivity](./interactivity.md).  
2. Copy the closest [example](../examples/README.md).  
3. Check browser Console + Network (and WS frames for Live).  
4. Product rules: [Architecture](./architecture.md) · [AGENTS.md](../AGENTS.md).
