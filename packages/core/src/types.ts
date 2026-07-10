/** Shared VNode tree — isomorphic for browser + SSR. */
export type PotatoChild =
  | VNode
  | string
  | number
  | boolean
  | null
  | undefined
  | PotatoChild[]

export type Props = Record<string, unknown> & {
  key?: string | number
  children?: PotatoChild
  ref?: (el: Element | null) => void
  dangerouslySetInnerHTML?: { __html: string }
}

export interface VNode {
  type: string | ComponentFn
  props: Props
  key?: string | number
  /** Internal: cached DOM node after first render */
  _el?: Node
  /** Internal: component instance */
  _component?: ComponentInstance
}

export type ComponentFn<P extends Props = Props> = (
  props: P,
  ctx: ComponentContext,
) => PotatoChild

export interface ComponentContext {
  state: AppState
  emit: Emit
  id: string
}

export interface ComponentInstance {
  id: string
  fn: ComponentFn
  props: Props
  vnode: VNode | null
  local: Record<string, unknown>
}

/** Application state bag — freely extensible. */
export type AppState = {
  events: typeof import("./events.js").EVENTS
  params: Record<string, string>
  query: Record<string, string>
  href: string
  route: string
  title: string
  cache: ComponentCache
  [key: string]: unknown
}

export type Emit = (event: string, ...args: unknown[]) => void

export type EmitterListener = (...args: unknown[]) => void

export type Store = (state: AppState, emitter: Emitter, app: PotatoApp) => void

export type View = (state: AppState, emit: Emit) => PotatoChild

export interface RouteMatch {
  route: string
  params: Record<string, string>
  view: View
}

export interface Emitter {
  on(event: string, listener: EmitterListener): void
  once(event: string, listener: EmitterListener): void
  off(event: string, listener?: EmitterListener): void
  emit(event: string, ...args: unknown[]): void
  listeners(event: string): EmitterListener[]
  clear(): void
}

export type ComponentCache = (
  Component: new (
    id: string,
    state: AppState,
    emit: Emit,
    ...args: unknown[]
  ) => StatefulComponent,
  id: string,
  ...args: unknown[]
) => StatefulComponent

export interface StatefulComponent {
  id: string
  local: Record<string, unknown>
  element: Element | null
  load?(el: Element): void
  unload?(el: Element): void
  update?(...args: unknown[]): boolean
  createElement(...args: unknown[]): PotatoChild
  render(...args: unknown[]): PotatoChild
}

export interface PotatoOptions {
  /** Listen to history API. Default true. */
  history?: boolean
  /** Intercept relative <a> clicks. Default true. */
  href?: boolean
  /** Treat hash as path segment. Default false. */
  hash?: boolean
  /** Component cache size (LRU). Default 100. */
  cache?: number
  /** Initial state (SSR rehydration). */
  initialState?: Partial<AppState>
  /** Enable debug event tracing. */
  debug?: boolean
  /**
   * Rethrow errors from event handlers after logging / `error` listeners.
   * Default: `true` when `debug` is on or `NODE_ENV !== "production"`.
   * Production default is `false` (log only) so one bad handler cannot
   * take down the whole bus — set `true` for fail-fast apps.
   */
  throwOnHandlerError?: boolean
}

export interface PotatoApp {
  state: AppState
  emitter: Emitter
  use(store: Store): PotatoApp
  route(path: string, view: View): PotatoApp
  mount(selector: string | Element): PotatoApp
  start(): Element
  toString(location: string, state?: Partial<AppState>): string
  toVNode(location: string, state?: Partial<AppState>): PotatoChild
  render(): void
  /** Navigate programmatically */
  navigate(path: string, opts?: { replace?: boolean }): void
  /** Access registered routes (for SSR/Live) */
  routes(): ReadonlyArray<{ path: string; view: View }>
  /** Get matched view for a location */
  match(location: string): RouteMatch | null
}
