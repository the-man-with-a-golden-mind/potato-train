import type { ComponentCache } from "./types.js"
import type { EVENTS } from "./events.js"

/**
 * Core fields always present. **No index signature** —
 * unknown keys are a compile error when using typed apps.
 */
export type CoreState = {
  events: typeof EVENTS
  params: Record<string, string>
  query: Record<string, string>
  href: string
  route: string
  title: string
  cache: ComponentCache
}

/**
 * Strict app state = core + your slice.
 * Prefer this over AppState when you want compile-time safety.
 */
export type StrictState<S extends Record<string, unknown> = Record<string, never>> =
  CoreState & S

/**
 * View state for a specific route pattern (typed params).
 */
export type RouteState<
  S extends Record<string, unknown>,
  Params extends Record<string, string>,
> = Omit<StrictState<S>, "params"> & { params: Params }
