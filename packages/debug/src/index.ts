import type { AppState, PotatoApp, Store } from "@potato/core"
import { EVENTS } from "@potato/core"

export interface DevtoolsOptions {
  /** Log every event. Default true */
  log?: boolean
  /** Expose window.__POTATO__ inspector. Default true */
  expose?: boolean
  /** Filter events (return false to skip). */
  filter?: (event: string, args: unknown[]) => boolean
  /** History size. Default 200 */
  history?: number
}

export interface PotatoInspector {
  state: AppState
  history: Array<{ t: number; event: string; args: unknown[] }>
  emit: (event: string, ...args: unknown[]) => void
  clear: () => void
}

/**
 * choo-devtools style store — drop in with app.use(devtools()).
 *
 * @example
 * ```ts
 * import { devtools } from '@potato/debug'
 * if (import.meta.env?.DEV) app.use(devtools())
 * ```
 */
export function devtools(opts: DevtoolsOptions = {}): Store {
  const log = opts.log !== false
  const expose = opts.expose !== false
  const max = opts.history ?? 200
  const history: PotatoInspector["history"] = []

  return (state, emitter, app) => {
    emitter.on("*", () => {}) // no-op placeholder

    // Patch emit tracing via listening to all known events is hard;
    // wrap emitter.emit instead.
    const original = emitter.emit.bind(emitter)
    emitter.emit = (event: string, ...args: unknown[]) => {
      if (!opts.filter || opts.filter(event, args)) {
        history.push({ t: Date.now(), event, args })
        if (history.length > max) history.shift()
        if (log && event !== EVENTS.TRACE) {
          const style = "color:#f59e0b;font-weight:bold"
          console.log(`%c potato %c ${event}`, style, "color:inherit", ...args)
        }
      }
      return original(event, ...args)
    }

    if (expose && typeof window !== "undefined") {
      const inspector: PotatoInspector = {
        get state() {
          /* v8 ignore next */
          return state
        },
        history,
        emit: (e, ...a) => emitter.emit(e, ...a),
        clear: () => {
          history.length = 0
        },
      }
      ;(window as Window & { __POTATO__?: PotatoInspector }).__POTATO__ =
        inspector
      console.info(
        "%c[potato/debug]%c window.__POTATO__ ready",
        "color:#f59e0b;font-weight:bold",
        "color:inherit",
      )
    }

    // timing renders
    let lastRender = 0
    emitter.on(EVENTS.RENDER, () => {
      const now = performance.now()
      if (lastRender && log) {
        console.log(
          `%c potato %c render +${(now - lastRender).toFixed(1)}ms`,
          "color:#22c55e;font-weight:bold",
          "color:inherit",
        )
      }
      lastRender = now
    })

    // silence unused
    void app
  }
}

/** Attach debug to an existing app (alternative to store). */
export function attachDebug(app: PotatoApp, opts?: DevtoolsOptions): void {
  app.use(devtools(opts))
}
