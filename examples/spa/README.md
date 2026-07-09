# SPA example

Client-only Potato app: **Vite + Tailwind + typed features**.

## Run

From monorepo root:

```bash
pnpm install && pnpm build
pnpm dev:spa
```

Or:

```bash
cd examples/spa
pnpm dev
```

Open the Vite URL (usually `http://localhost:5173`).

## What it shows

| Piece | Role |
|--------|------|
| `createApp<State, Events>` | Typed app entry |
| `defineFeature` | Counter slice + handlers |
| `patch` | State update + re-render |
| Tailwind v4 | `@tailwindcss/vite` + `src/styles.css` |
| `@potato/debug` | Timeline, state diffs, panel (**Ctrl+Shift+P**), `window.__POTATO__` |

## Layout

```text
src/main.tsx      # app + routes
src/styles.css    # @import "tailwindcss"
vite.config.ts    # potato() + tailwindcss()
index.html
```

## Architecture

Views only `emit`. Logic is in the feature `setup`.  
Rename an event in `Events` → TypeScript lists every call site.

See [docs/architecture.md](../../docs/architecture.md).
