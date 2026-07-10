# Potato v0.2.0

Safety-focused release of **Potato** — a typed, Choo-shaped TypeScript framework.

## Highlights

- **One app architecture:** `createApp<State, Events>` + `defineFeature` + `patch`
- **Pure views**; client **`emit`s intents**; Live **`onEvent(session.state)`** only
- Isolated SSR state; request-local context; CORS same-origin by default
- Safer Live session rendering with serialized fallback event handling
- `store.update()` now renders; DOM morph clears removed object styles
- Optional **SSR**, **Live** (WebSocket morph), **auth**, **Drizzle DB**, **Cloudflare Workers**
- **create-potato** scaffold (`spa` / `ssr`)
- Working demos: SPA, SSR+Live, spreadsheet (50k rows), portfolio, Trello multiplayer

## Install

```bash
pnpm create potato my-app
# or
pnpm add potato-train-core potato-train-jsx
```

```ts
import { createApp, defineFeature, combineState, useFeatures } from 'potato-train-core'
```

## Packages published

`potato-train-core` · `potato-train-jsx` · `html` · `ssr` · `live` · `auth` · `db` · `cloudflare` · `formula` · `virtual` · `debug` · `vite-plugin` · `create-potato`

> The unscoped name `potato` is already taken on npm. Use **`potato-train-*`** packages.

## Docs

- [Architecture](https://github.com/OWNER/REPO/blob/v0.2.0/docs/architecture.md)
- [Getting started](https://github.com/OWNER/REPO/blob/v0.2.0/docs/getting-started.md)
- [Interactivity](https://github.com/OWNER/REPO/blob/v0.2.0/docs/interactivity.md)
- [CHANGELOG](https://github.com/OWNER/REPO/blob/v0.2.0/CHANGELOG.md)
- Agents: `AGENTS.md` · `llms.txt`

## Full changelog

See [CHANGELOG.md](../CHANGELOG.md) for the complete list.
