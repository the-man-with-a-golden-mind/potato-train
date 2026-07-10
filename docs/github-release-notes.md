# Potato v0.3.0

Performance and correctness release for bigger apps, on top of the
safety-focused **v0.2.0** package set.

## Highlights

- **DOM morph reconciliation rewritten** — children are matched by key first,
  then by first-available same-type match, instead of pure positional
  diffing. Handles reordering and mixed keyed/unkeyed lists correctly on
  both the client morph (`morph.ts`) and the Live/SSR HTML morph
  (`morph-html.ts`).
- **Route views are auto-keyed** — `app.route()` now tags each route's root
  vnode with a route-derived key (unless the view sets its own), so
  navigating between routes that happen to render the same root tag (e.g.
  two routes both rooted in `<main>`) always tears down and recreates the
  DOM instead of incorrectly morphing one route's view into another's.
- **Granular state serialization** — SSR and Live no longer drop the entire
  state payload when a single field fails to serialize (e.g. a circular
  reference); only that field is skipped, with a console warning naming it.
- **Live shared-state pruning** — keys removed from a session's state are
  now also removed from the broadcast "shared" state, instead of lingering
  indefinitely.
- **CORS preflight** — a disallowed cross-origin `OPTIONS` request now gets
  an explicit `400`, instead of a same-looking `204` with no CORS headers.
- **create-potato** — scaffolded apps pin `packageManager` (for a consistent
  Corepack-resolved pnpm) and the SSR template's `trustedDependencies`
  covers `esbuild`/`@parcel/watcher` so `bun install` doesn't silently skip
  their native builds.
- New demo: **Saper** (Minesweeper) — Live multiplayer example.
- Still: one app architecture (`createApp<State, Events>` + `defineFeature`
  + `patch`), pure views, isolated SSR state, optional SSR/Live/auth/DB/
  Cloudflare.

## Install

```bash
# npm / pnpm / bun (flags after -- for npm & pnpm)
npm create potato@latest my-app -- --template=ssr
pnpm create potato my-app -- --template=ssr
bun create potato my-app --template=ssr
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

- [Architecture](https://github.com/the-man-with-a-golden-mind/potato-train/blob/v0.3.0/docs/architecture.md)
- [Getting started](https://github.com/the-man-with-a-golden-mind/potato-train/blob/v0.3.0/docs/getting-started.md)
- [Interactivity](https://github.com/the-man-with-a-golden-mind/potato-train/blob/v0.3.0/docs/interactivity.md)
- [CHANGELOG](https://github.com/the-man-with-a-golden-mind/potato-train/blob/v0.3.0/CHANGELOG.md)
- Agents: `AGENTS.md` · `llms.txt`

## Full changelog

See [CHANGELOG.md](../CHANGELOG.md) for the complete list.
