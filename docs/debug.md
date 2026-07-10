# Debugger (`potato-train-debug`)

Potato’s developer tools show **what emitted**, **what re-rendered**, and **what changed in state**.

## Quick start

```ts
import { devtools } from 'potato-train-debug'

const app = createApp<State, Events>({ state: … })
app.use(devtools()) // before or after features — usually early

// SPA example already does this:
// if (import.meta.env.DEV) app.use(devtools())
```

### In the browser

| Action | Result |
|--------|--------|
| **Ctrl+Shift+P** | Toggle floating panel |
| Click **🥔 Debug** | Open panel |
| `window.__POTATO__` | Programmatic inspector |

### Panel tabs

| Tab | Shows |
|-----|--------|
| **Timeline** | Every `emit` + renders, with state-diff previews |
| **State** | Live JSON snapshot of app state |
| **Detail** | Full args + full diff for a selected row |

Color coding: **blue** user events · **green** renders · **purple** navigation · **gray** framework.

---

## Console

When `log: true` (default):

```text
potato  counter:inc  1
potato  Δ state
~ count: 0 → 1
potato  render +2.4ms
```

---

## `window.__POTATO__` API

```ts
__POTATO__.state          // live state object
__POTATO__.history        // timeline entries
__POTATO__.stats          // { events, renders, lastRenderMs }
__POTATO__.emit('x', …)   // dispatch into the app
__POTATO__.clear()        // wipe timeline
__POTATO__.open() / .close() / .toggle()
__POTATO__.subscribe(rec => { … })  // listen to new records
```

Each history entry:

```ts
{
  id: number
  t: number              // Date.now()
  event: string
  args: unknown[]
  kind: 'event' | 'render' | 'navigate' | 'framework'
  diffs: Array<{ path, kind: 'add'|'remove'|'change', from?, to? }>
  renderMs?: number
  stateAfter?: object
}
```

---

## Options

```ts
devtools({
  log: true,              // console
  expose: true,           // window.__POTATO__
  panel: true,            // floating UI (browser only)
  open: false,            // open panel on load
  history: 300,           // max timeline rows
  trackState: true,       // snapshot + diff before/after each emit
  quietFramework: false,  // hide navigate/trace noise in console
  filter: (event, args) => event !== 'noisy',
})
```

---

## How state diffs work

On every `emitter.emit`:

1. Snapshot state (JSON-safe clone; skips `cache` / functions)
2. Run the real emit (handlers may `set` / `patch`)
3. Snapshot again and **diff**
4. Append to history + panel

You see **which emit changed which fields** — including `patch` from features.

---

## Tips

| Goal | Approach |
|------|----------|
| Only user events in console | `quietFramework: true` |
| Production | Do not load `potato-train-debug` (or `if (import.meta.env.DEV)`) |
| Custom overlay | `subscribe` + your own UI |
| Live multiplayer | Debugger is per-client; server events appear when that client emits / receives |

---

## Example (SPA)

```ts
import { devtools } from 'potato-train-debug'

const app = createApp<State, Events>({ state: combineState(counter) })
app.use(devtools({ open: false }))
useFeatures(app, counter)
app.mount('#app')
```

Then click **+1** and open the panel — you should see `counter:inc`, a count diff, and a following `render`.
