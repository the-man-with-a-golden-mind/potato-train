# TEA / Elm-like path (advanced — not product default)

> **You do not need this document to use Potato.**

This is **optional research** for teams that want a single pure `update` function.  
The **product architecture** is typed Choo:

→ **[architecture.md](./architecture.md)** — `createApp` + `State` + `Events` + features.

## Why not the default?

Potato already provides **compile-time refactor safety** via:

```ts
type Events = { 'todo:add': [title: string] }
createApp<State, Events>(…)
```

That is the TypeScript equivalent of a closed intent catalog **without** forcing:

- a single global `update`
- a `Cmd` algebra
- a different mental model from Choo

Full Elm Architecture (Model / Msg / update / Cmd) can still be layered **on top** of Potato for an individual app that wants one pure reducer. It is **not** required, scaffolded, or taught as the default.

## If you still want TEA locally

You can implement a private reducer inside a feature:

```ts
type Msg =
  | { type: 'inc'; n?: number }
  | { type: 'reset' }

function reduce(state: S, msg: Msg): S { /* pure */ }

// Map Events → Msg inside the feature setup, or expose only Events outward.
```

Or build a thin `createTeaApp` wrapper in your app repo. Upstream Potato remains **feature + Events**.

## Historical note

Earlier drafts considered TEA as the only product path. That was rejected: it rewrites Potato into Elm instead of **hardening** the Choo design with types.
