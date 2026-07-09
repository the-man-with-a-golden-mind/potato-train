/**
 * Feature modules — the product unit for growing Potato apps.
 *
 * A feature is: typed state slice + typed events + store setup.
 * Composition is type intersection (State & Events), not grep.
 *
 * @example
 * ```ts
 * const counter = defineFeature<{ count: number }, { 'counter:inc': [n?: number] }>({
 *   name: 'counter',
 *   state: { count: 0 },
 *   setup: ({ get, patch, on }) => {
 *     on('counter:inc', (n) => patch({ count: get().count + (n ?? 1) }))
 *   },
 * })
 *
 * type State = InferFeatureState<typeof counter>
 * type Events = InferFeatureEvents<typeof counter>
 * const app = createApp<State, Events>({ state: counter.state })
 * app.use(counter.store)
 * ```
 */
import { defineStore, type StoreSetup } from "./store.js"
import type { Store } from "./types.js"
import type { EventMap } from "./typed-events.js"

/**
 * A feature is a named, typed unit of app logic.
 * `_state` / `_events` are phantom fields for inference only.
 */
export interface Feature<
  S extends Record<string, unknown> = Record<string, never>,
  E extends EventMap = EventMap,
> {
  readonly name: string
  readonly state: S
  readonly store: Store
  /** @internal phantom — do not read at runtime */
  readonly _state: S
  /** @internal phantom — do not read at runtime */
  readonly _events: E
}

export type InferFeatureState<F> = F extends Feature<infer S, EventMap> ? S : never
export type InferFeatureEvents<F> = F extends Feature<Record<string, unknown>, infer E>
  ? E
  : never

/** Intersect state slices from a tuple of features */
export type CombineFeatureStates<Fs extends readonly Feature<any, any>[]> =
  Fs extends readonly []
    ? Record<string, never>
    : Fs extends readonly [Feature<infer S, any>, ...infer Rest]
      ? Rest extends readonly Feature<any, any>[]
        ? S & CombineFeatureStates<Rest>
        : S
      : Record<string, never>

/** Intersect event maps from a tuple of features */
export type CombineFeatureEvents<Fs extends readonly Feature<any, any>[]> =
  Fs extends readonly []
    ? Record<string, never>
    : Fs extends readonly [Feature<any, infer E>, ...infer Rest]
      ? Rest extends readonly Feature<any, any>[]
        ? E & CombineFeatureEvents<Rest>
        : E
      : Record<string, never>

export interface DefineFeatureConfig<
  S extends Record<string, unknown>,
  E extends EventMap,
> {
  /** Unique store name (debug / devtools) */
  name: string
  /** Initial state slice — keys become app state fields */
  state: S
  /**
   * Store setup. Prefer `patch()` over `set` + `emit('render')`.
   * Views must only `emit`; all logic lives here.
   */
  setup: StoreSetup<S, E>
}

/**
 * Define a typed feature (state + events + handlers).
 * Events are enforced by the generic `E` on `on` / `emit` / `patch` via defineStore.
 */
export function defineFeature<
  S extends Record<string, unknown>,
  E extends EventMap = EventMap,
>(config: DefineFeatureConfig<S, E>): Feature<S, E> {
  const store = defineStore<S, E>(config.name, config.state, config.setup)
  return {
    name: config.name,
    state: config.state,
    store,
    _state: undefined as unknown as S,
    _events: undefined as unknown as E,
  }
}

/**
 * Merge initial state from features (runtime).
 * Types: use `CombineFeatureStates<typeof features>` or explicit `State = A & B`.
 */
export function combineState<const Fs extends readonly Feature<any, any>[]>(
  ...features: Fs
): CombineFeatureStates<Fs> {
  const out: Record<string, unknown> = {}
  for (const f of features) {
    Object.assign(out, f.state)
  }
  return out as CombineFeatureStates<Fs>
}

/**
 * Register every feature store on a `use`-capable app.
 */
export function useFeatures(
  app: { use: (store: Store) => unknown },
  ...features: Feature<any, any>[]
): void {
  for (const f of features) {
    app.use(f.store)
  }
}

/**
 * Prefix every key of an event map: `{ inc: [] }` + `"counter"` → `{ "counter:inc": [] }`.
 * Use for namespacing without losing payload types.
 *
 * @example
 * type E = PrefixEvents<'sheet', { select: [key: string]; scroll: [{ top: number }] }>
 * // { 'sheet:select': [key: string]; 'sheet:scroll': [{ top: number }] }
 */
export type PrefixEvents<
  Prefix extends string,
  E extends EventMap,
> = {
  [K in keyof E & string as `${Prefix}:${K}`]: E[K]
}

/**
 * Build a runtime event name with a prefix (typed result).
 */
export function eventName<P extends string, K extends string>(
  prefix: P,
  key: K,
): `${P}:${K}` {
  return `${prefix}:${key}`
}
