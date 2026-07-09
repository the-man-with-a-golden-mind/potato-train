import type { Emitter, EmitterListener } from "./types.js"

/**
 * Tiny typed event bus (nanobus-inspired).
 * Functional-friendly, zero deps.
 */
export function createEmitter(debug = false): Emitter {
  const map = new Map<string, Set<EmitterListener>>()

  const on = (event: string, listener: EmitterListener): void => {
    let set = map.get(event)
    if (!set) {
      set = new Set()
      map.set(event, set)
    }
    set.add(listener)
  }

  const off = (event: string, listener?: EmitterListener): void => {
    if (!listener) {
      map.delete(event)
      return
    }
    map.get(event)?.delete(listener)
  }

  const once = (event: string, listener: EmitterListener): void => {
    const wrap: EmitterListener = (...args) => {
      off(event, wrap)
      listener(...args)
    }
    on(event, wrap)
  }

  const emit = (event: string, ...args: unknown[]): void => {
    if (debug && event !== "trace") {
      map.get("trace")?.forEach((fn) => {
        try {
          fn(event, ...args)
        } catch {
          /* ignore trace errors */
        }
      })
    }
    const set = map.get(event)
    if (!set) return
    for (const fn of [...set]) {
      try {
        fn(...args)
      } catch (err) {
        const errors = map.get("error")
        if (errors && errors.size > 0) {
          for (const handler of errors) handler(err, event)
        } else if (typeof console !== "undefined") {
          console.error(`[potato] error in '${event}':`, err)
        }
      }
    }
  }

  const listeners = (event: string): EmitterListener[] =>
    [...(map.get(event) ?? [])]

  const clear = (): void => {
    map.clear()
  }

  return { on, once, off, emit, listeners, clear }
}
