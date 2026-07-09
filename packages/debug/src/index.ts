/**
 * @potato/debug — event timeline, state diffs, render timing, floating panel.
 *
 * @example
 * ```ts
 * import { devtools } from '@potato/debug'
 * app.use(devtools()) // or devtools({ panel: true, log: true })
 * // window.__POTATO__ · Ctrl+Shift+P
 * ```
 */
import type { AppState, PotatoApp, Store } from "@potato/core"
import { EVENTS } from "@potato/core"
import { diffState, formatDiff, snapshotState, type DiffEntry } from "./diff.js"
import { classifyEvent, createPanel, type PanelApi, type PanelRecord } from "./panel.js"

export type { DiffEntry, PanelRecord }
export { diffState, formatDiff, snapshotState, classifyEvent }

export interface DevtoolsOptions {
  /** Log to console. Default true */
  log?: boolean
  /** Expose window.__POTATO__. Default true */
  expose?: boolean
  /** Floating UI panel. Default true in browsers */
  panel?: boolean
  /** Open panel on start. Default false */
  open?: boolean
  /** Filter events (return false to skip recording). */
  filter?: (event: string, args: unknown[]) => boolean
  /** Skip framework noise in console (still recorded). Default false */
  quietFramework?: boolean
  /** History size. Default 300 */
  history?: number
  /** Capture state snapshot after each event. Default true */
  trackState?: boolean
}

export interface HistoryEntry {
  id: number
  t: number
  event: string
  args: unknown[]
  kind: PanelRecord["kind"]
  diffs: DiffEntry[]
  renderMs?: number
  stateAfter?: Record<string, unknown>
}

export interface PotatoInspector {
  /** Live app state (same object) */
  readonly state: AppState
  /** Recorded timeline */
  readonly history: HistoryEntry[]
  /** Emit into the app */
  emit: (event: string, ...args: unknown[]) => void
  /** Clear timeline */
  clear: () => void
  /** Open / close / toggle UI panel */
  open: () => void
  close: () => void
  toggle: () => void
  /** Stats */
  readonly stats: {
    events: number
    renders: number
    lastRenderMs: number
  }
  /** Subscribe to new records (devtools extensions) */
  subscribe: (fn: (rec: HistoryEntry) => void) => () => void
}

let seq = 0

/**
 * Drop-in store: `app.use(devtools())`.
 */
export function devtools(opts: DevtoolsOptions = {}): Store {
  const log = opts.log !== false
  const expose = opts.expose !== false
  const trackState = opts.trackState !== false
  const max = opts.history ?? 300
  const quietFramework = opts.quietFramework === true
  const wantPanel =
    opts.panel !== false && typeof document !== "undefined"

  return (state, emitter, _app) => {
    const history: HistoryEntry[] = []
    const listeners = new Set<(rec: HistoryEntry) => void>()
    let eventCount = 0
    let renderCount = 0
    let lastRenderAt = 0
    let lastRenderMs = 0
    let panel: PanelApi | null = null

    const original = emitter.emit.bind(emitter)

    function record(
      event: string,
      args: unknown[],
      diffs: DiffEntry[],
      extra?: { renderMs?: number; stateAfter?: Record<string, unknown> },
    ): HistoryEntry {
      const rec: HistoryEntry = {
        id: ++seq,
        t: Date.now(),
        event,
        args,
        kind: classifyEvent(event),
        diffs,
        renderMs: extra?.renderMs,
        stateAfter: extra?.stateAfter,
      }
      history.push(rec)
      while (history.length > max) history.shift()
      for (const fn of listeners) {
        try {
          fn(rec)
        } catch {
          /* ignore subscriber errors */
        }
      }
      panel?.push(rec)
      return rec
    }

    emitter.emit = (event: string, ...args: unknown[]) => {
      if (opts.filter && !opts.filter(event, args)) {
        return original(event, ...args)
      }

      const before = trackState
        ? snapshotState(state as Record<string, unknown>)
        : {}

      const t0 = performance.now()
      const result = original(event, ...args)
      const t1 = performance.now()

      const after = trackState
        ? snapshotState(state as Record<string, unknown>)
        : {}
      const diffs = trackState ? diffState(before, after) : []

      if (event === EVENTS.RENDER) {
        renderCount++
        lastRenderMs = lastRenderAt ? t1 - lastRenderAt : t1 - t0
        // wall gap between renders is more useful for "how often"
        const gap = lastRenderAt ? t1 - lastRenderAt : t1 - t0
        lastRenderAt = t1
        lastRenderMs = gap
        record(event, args, diffs, {
          renderMs: gap,
          stateAfter: trackState ? after : undefined,
        })
        if (log) {
          console.log(
            `%c potato %c render %c+${gap.toFixed(1)}ms`,
            "color:#22c55e;font-weight:bold",
            "color:#86efac",
            "color:#94a3b8",
          )
        }
      } else {
        eventCount++
        const rec = record(event, args, diffs, {
          stateAfter: trackState ? after : undefined,
        })
        const isFw = rec.kind === "framework" || rec.kind === "navigate"
        if (log && event !== EVENTS.TRACE && !(quietFramework && isFw)) {
          const color =
            rec.kind === "event"
              ? "#38bdf8"
              : rec.kind === "navigate"
                ? "#c084fc"
                : "#94a3b8"
          console.log(
            `%c potato %c ${event}`,
            `color:${color};font-weight:bold`,
            "color:inherit",
            ...args,
          )
          if (diffs.length && log) {
            console.log(
              `%c potato %c Δ state\n${formatDiff(diffs)}`,
              "color:#fbbf24;font-weight:bold",
              "color:#fcd34d",
            )
          }
        }
      }

      panel?.setState(state)
      panel?.setStats({
        events: eventCount,
        renders: renderCount,
        lastRenderMs,
      })

      return result
    }

    if (wantPanel) {
      panel = createPanel({ maxRows: max })
      if (opts.open) panel.open()
    }

    const inspector: PotatoInspector = {
      get state() {
        return state
      },
      history,
      emit: (e, ...a) => {
        emitter.emit(e, ...a)
      },
      clear: () => {
        history.length = 0
      },
      open: () => panel?.open(),
      close: () => panel?.close(),
      toggle: () => panel?.toggle(),
      get stats() {
        return {
          events: eventCount,
          renders: renderCount,
          lastRenderMs,
        }
      },
      subscribe(fn) {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
    }

    if (expose && typeof window !== "undefined") {
      ;(window as Window & { __POTATO__?: PotatoInspector }).__POTATO__ =
        inspector
      console.info(
        "%c[potato/debug]%c window.__POTATO__ · Ctrl+Shift+P · timeline + state diffs",
        "color:#f59e0b;font-weight:bold",
        "color:inherit",
      )
    }
  }
}

/** Attach debug to an existing app. */
export function attachDebug(app: PotatoApp, opts?: DevtoolsOptions): void {
  app.use(devtools(opts))
}

/** Typed helper for createApp: `app.use(devtools())` already works. */
export default devtools
