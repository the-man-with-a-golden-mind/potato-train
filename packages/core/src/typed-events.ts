import type { EVENTS } from "./events.js"

/**
 * Event maps turn typos and wrong payloads into **compile errors**.
 *
 * @example
 * type AppEvents = {
 *   increment: [delta: number]
 *   reset: []
 *   'todo:add': [title: string]
 * }
 */

/** Map of event name → argument tuple */
export type EventMap = Record<string, readonly unknown[]>

/** Framework built-ins always available on typed emit/on */
export type FrameworkEventMap = {
  render: []
  navigate: []
  pushState: [path?: string]
  replaceState: [path?: string]
  popState: []
  DOMContentLoaded: []
  DOMTitleChange: [title?: string]
  error: [err: unknown, event?: string]
  trace: [event: string, ...args: unknown[]]
  "live:patch": [payload?: unknown]
  "live:event": [payload?: unknown]
}

/** Merge user events with framework events (user wins on conflict) */
export type WithFrameworkEvents<E extends EventMap> = FrameworkEventMap & E

/** Payload tuple for an event key */
export type EventArgs<
  E extends EventMap,
  K extends keyof E,
> = E[K] extends readonly unknown[] ? E[K] : never

/**
 * Typed emit — only known events; args must match the tuple.
 * Optional trailing args allowed when the tuple member is optional.
 */
export type TypedEmit<E extends EventMap> = <K extends keyof E & string>(
  event: K,
  ...args: EventArgs<E, K> extends readonly []
    ? []
    : PartialableArgs<EventArgs<E, K>>
) => void

/** Make args required unless the tuple element is optional (`x?: T`) */
type PartialableArgs<T extends readonly unknown[]> = T

/**
 * Typed listener for one event.
 * Uses the event's argument tuple as rest parameters (preserves optionals).
 */
export type TypedListener<E extends EventMap, K extends keyof E & string> = (
  ...args: EventArgs<E, K> extends readonly unknown[]
    ? EventArgs<E, K>
    : never
) => void

export type TypedOn<E extends EventMap> = <K extends keyof E & string>(
  event: K,
  listener: TypedListener<E, K>,
) => void

/** Helper to declare events with full inference */
export function defineEvents<E extends EventMap>(events: {
  [K in keyof E]: true
}): E {
  return events as unknown as E
}

/** Runtime event name constants aligned with EVENTS */
export type FrameworkEventName =
  (typeof EVENTS)[keyof typeof EVENTS]
