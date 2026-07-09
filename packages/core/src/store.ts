import { EVENTS } from "./events.js"
import type { AppState, Store } from "./types.js"
import type {
  EventMap,
  TypedEmit,
  TypedOn,
  WithFrameworkEvents,
} from "./typed-events.js"
/**
 * Typed store API.
 *
 * Pass `Events` generic (or use `defineStore<S, E>(...)`) so
 * `on('typo')` / `emit('typo')` fail at compile time.
 *
 * Prefer `patch(partial)` — sets state and re-renders in one call.
 */
export interface StoreApi<
  S extends Record<string, unknown>,
  E extends EventMap = EventMap,
> {
  get(): AppState & S
  /** Merge into state (no render). Prefer `patch` for UI updates. */
  set(patch: Partial<S>): void
  /**
   * Merge into state and emit `render`.
   * Preferred for almost all handlers — avoids forgotten paints.
   */
  patch(partial: Partial<S>): void
  update(fn: (draft: AppState & S) => void): void
  on: TypedOn<WithFrameworkEvents<E>>
  emit: TypedEmit<WithFrameworkEvents<E>>
  name: string
}

export type StoreSetup<
  S extends Record<string, unknown>,
  E extends EventMap = EventMap,
> = (api: StoreApi<S, E>) => void

function isSetupFn(x: unknown): x is StoreSetup<Record<string, unknown>> {
  return typeof x === "function"
}

/**
 * Define a typed store.
 *
 * Always pass `State` and `Events` generics so `on` / `emit` / `patch` are checked.
 *
 * @example
 * ```ts
 * type E = { increment: [n?: number] }
 * defineStore<{ count: number }, E>('count', { count: 0 }, ({ get, patch, on }) => {
 *   on('increment', (n) => {
 *     patch({ count: get().count + (n ?? 1) })
 *   })
 *   // on('incremnt', ...) // compile error
 * })
 * ```
 */
export function defineStore<
  S extends Record<string, unknown>,
  E extends EventMap = EventMap,
>(name: string, initial: S, setup: StoreSetup<S, E>): Store
export function defineStore<
  S extends Record<string, unknown>,
  E extends EventMap = EventMap,
>(name: string, setup: StoreSetup<S, E>): Store
export function defineStore<
  S extends Record<string, unknown>,
  E extends EventMap = EventMap,
>(
  name: string,
  initialOrSetup: S | StoreSetup<S, E>,
  maybeSetup?: StoreSetup<S, E>,
): Store {
  const hasInitial = !isSetupFn(initialOrSetup)
  const initial = (hasInitial ? initialOrSetup : {}) as S
  const setup = (hasInitial ? maybeSetup : initialOrSetup) as StoreSetup<S, E>

  if (!setup) {
    throw new Error(`[potato] defineStore('${name}') missing setup function`)
  }

  const store: Store = (state, emitter) => {
    for (const [k, v] of Object.entries(initial)) {
      if (state[k] === undefined) {
        ;(state as Record<string, unknown>)[k] = v
      }
    }

    const get = (): AppState & S => state as AppState & S

    const set = (partial: Partial<S>): void => {
      Object.assign(state, partial)
    }

    const patch = (partial: Partial<S>): void => {
      Object.assign(state, partial)
      emitter.emit(EVENTS.RENDER)
    }

    const update = (fn: (draft: AppState & S) => void): void => {
      fn(state as AppState & S)
    }

    const api: StoreApi<S, E> = {
      get,
      set,
      patch,
      update,
      on: ((event: string, listener: (...a: unknown[]) => void) =>
        emitter.on(event, listener)) as unknown as TypedOn<
        WithFrameworkEvents<E>
      >,
      emit: ((event: string, ...args: unknown[]) =>
        emitter.emit(event, ...args)) as unknown as TypedEmit<
        WithFrameworkEvents<E>
      >,
      name,
    }

    setup(api)
  }

  ;(store as Store & { storeName?: string }).storeName = name
  return store
}

/** Infer state slice from a defineStore initial value (type-only helper). */
export type InferStoreState<T> = T extends { __state: infer S } ? S : never
