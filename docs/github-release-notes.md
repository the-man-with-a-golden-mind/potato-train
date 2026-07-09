# Potato v0.1.0

First public release of **Potato** — a typed, Choo-shaped TypeScript framework.

## Highlights

- **One app architecture:** `createApp<State, Events>` + `defineFeature` + `patch`
- Views only **`emit`**; refactors use **TypeScript**, not grep
- Optional **SSR**, **Live** (WebSocket morph), **auth**, **Drizzle DB**, **Cloudflare Workers**
- **create-potato** scaffold (`spa` / `ssr`)
- Working demos: SPA, SSR+Live, spreadsheet (50k rows), portfolio, Trello multiplayer

## Install

```bash
pnpm create potato my-app
# or
pnpm add @potato/core @potato/jsx
```

```ts
import { createApp, defineFeature, combineState, useFeatures } from '@potato/core'
```

## Packages published

`@potato/core` · `jsx` · `html` · `ssr` · `live` · `auth` · `db` · `cloudflare` · `formula` · `virtual` · `debug` · `vite-plugin` · `create-potato`

> The unscoped name `potato` is already taken on npm. Use `@potato/*` packages.

## Docs

- [Architecture](https://github.com/OWNER/REPO/blob/v0.1.0/docs/architecture.md)
- [Getting started](https://github.com/OWNER/REPO/blob/v0.1.0/docs/getting-started.md)
- [Interactivity](https://github.com/OWNER/REPO/blob/v0.1.0/docs/interactivity.md)
- [CHANGELOG](https://github.com/OWNER/REPO/blob/v0.1.0/CHANGELOG.md)
- Agents: `AGENTS.md` · `llms.txt`

## Full changelog

See [CHANGELOG.md](../CHANGELOG.md) for the complete list.
