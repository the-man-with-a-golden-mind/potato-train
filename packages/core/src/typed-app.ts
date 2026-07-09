import { potato } from "./app.js"
import type {
  AppState,
  Emit,
  Emitter,
  PotatoApp,
  PotatoChild,
  PotatoOptions,
  Store,
  View,
} from "./types.js"
import type {
  EventMap,
  FrameworkEventMap,
  TypedEmit,
  TypedOn,
  WithFrameworkEvents,
} from "./typed-events.js"
import type { PathParams } from "./typed-paths.js"
import type { RouteState, StrictState } from "./strict-state.js"

export type TypedView<
  S extends Record<string, unknown>,
  E extends EventMap,
  Params extends Record<string, string> = Record<string, string>,
> = (
  state: RouteState<S, Params>,
  emit: TypedEmit<WithFrameworkEvents<E>>,
) => PotatoChild

export type TypedStoreFn<
  S extends Record<string, unknown>,
  E extends EventMap,
> = (
  state: StrictState<S>,
  emitter: TypedEmitter<WithFrameworkEvents<E>>,
  app: TypedPotatoApp<S, E>,
) => void

export interface TypedEmitter<E extends EventMap> {
  on: TypedOn<E>
  once: TypedOn<E>
  off: TypedOn<E>
  emit: TypedEmit<E>
  listeners(event: keyof E & string): Array<(...args: unknown[]) => void>
  clear(): void
}

/**
 * Fully typed Potato app.
 *
 * - `state` has your fields without casts
 * - `emit('typo')` is a **compile error**
 * - `emit('inc', wrongType)` is a **compile error**
 * - `route('/u/:id')` types `state.params.id`
 */
export interface TypedPotatoApp<
  S extends Record<string, unknown> = Record<string, never>,
  E extends EventMap = Record<string, never>,
> {
  readonly state: StrictState<S>
  readonly emitter: TypedEmitter<WithFrameworkEvents<E>>
  /** Underlying untyped app (SSR / adapters) */
  readonly raw: PotatoApp

  use(store: TypedStoreFn<S, E> | Store): TypedPotatoApp<S, E>

  /** Register a feature's store (from `defineFeature`). */
  useFeature(feature: { store: Store }): TypedPotatoApp<S, E>

  route<P extends string>(
    path: P,
    view: TypedView<S, E, PathParams<P> & Record<string, string>>,
  ): TypedPotatoApp<S, E>

  mount(selector: string | Element): TypedPotatoApp<S, E>
  start(): Element
  toString(location: string, state?: Partial<StrictState<S>>): string
  toVNode(location: string, state?: Partial<StrictState<S>>): PotatoChild
  render(): void
  navigate(path: string, opts?: { replace?: boolean }): void
  routes(): ReadonlyArray<{ path: string; view: View }>
  match(location: string): ReturnType<PotatoApp["match"]>
  /** Typed emit bound to this app */
  emit: TypedEmit<WithFrameworkEvents<E>>
}

export interface CreateAppOptions<S extends Record<string, unknown>>
  extends Omit<PotatoOptions, "initialState"> {
  /** Initial user state (typed, required fields seeded) */
  state?: S
}

/**
 * Create a **strict** typed app — **the only entry point for application code**.
 *
 * `State` and `Events` are the type spine: renames and typos fail at compile time.
 * Use `potato()` only for framework internals / untyped adapters.
 *
 * @example
 * ```ts
 * type S = { count: number }
 * type E = { increment: [n?: number]; reset: [] }
 *
 * const app = createApp<S, E>({ state: { count: 0 } })
 *
 * app.use(defineStore<S, E>('count', { count: 0 }, ({ get, patch, on }) => {
 *   on('increment', (n = 1) => {
 *     patch({ count: get().count + (n ?? 1) })
 *   })
 * }))
 *
 * app.route('/', (state, emit) => {
 *   // state.count is number
 *   // emit('increment', 1) OK
 *   // emit('incremnt') // compile error
 *   return h('button', { onclick: () => emit('increment', 1) }, state.count)
 * })
 * ```
 */
export function createApp<
  S extends Record<string, unknown> = Record<string, never>,
  E extends EventMap = Record<string, never>,
>(opts: CreateAppOptions<S> = {}): TypedPotatoApp<S, E> {
  const { state: userState, ...rest } = opts
  const raw = potato({
    ...rest,
    initialState: userState as Partial<AppState>,
  })

  const emit = raw.emitter.emit.bind(raw.emitter) as TypedEmit<
    WithFrameworkEvents<E>
  >

  const app: TypedPotatoApp<S, E> = {
    get state() {
      return raw.state as StrictState<S>
    },
    get emitter() {
      return raw.emitter as unknown as TypedEmitter<WithFrameworkEvents<E>>
    },
    raw,
    emit,

    use(store) {
      raw.use(store as Store)
      return app
    },

    useFeature(feature) {
      raw.use(feature.store)
      return app
    },

    route(path, view) {
      const wrapped: View = (state, em) =>
        view(
          state as RouteState<S, PathParams<typeof path> & Record<string, string>>,
          em as TypedEmit<WithFrameworkEvents<E>>,
        )
      raw.route(path, wrapped)
      return app
    },

    mount(sel) {
      raw.mount(sel)
      return app
    },

    start: () => raw.start(),
    toString: (loc, st) => raw.toString(loc, st as Partial<AppState>),
    toVNode: (loc, st) => raw.toVNode(loc, st as Partial<AppState>),
    render: () => raw.render(),
    navigate: (p, o) => raw.navigate(p, o),
    routes: () => raw.routes(),
    match: (l) => raw.match(l),
  }

  return app
}

/**
 * Bridge: use a typed app with SSR (`createServer` expects PotatoApp).
 */
export function asRawApp<S extends Record<string, unknown>, E extends EventMap>(
  app: TypedPotatoApp<S, E>,
): PotatoApp {
  return app.raw
}

/** Type-only assert helpers for tests and docs */
export type Expect<T extends true> = T
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
