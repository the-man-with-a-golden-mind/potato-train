import { bindCache, Component } from "./cache.js"
import { createEmitter } from "./emitter.js"
import { EVENTS } from "./events.js"
import { createRoot, renderToString } from "./morph.js"
import { createRouter, parseLocation, parseQuery } from "./router.js"
import { isVNode } from "./vnode.js"
import type {
  AppState,
  Emit,
  PotatoApp,
  PotatoOptions,
  Store,
  View,
} from "./types.js"

export { Component }
export { defineStore } from "./store.js"
export type { StoreApi, StoreSetup } from "./store.js"
export type { PotatoApp, PotatoOptions, Store, View, AppState, Emit }

/**
 * Create a Potato app — modern Choo-compatible surface.
 *
 * @example
 * ```ts
 * const app = potato()
 * app.use(countStore)
 * app.route('/', (state, emit) => h('h1', null, state.count))
 * app.mount('#app')
 * ```
 */
export function potato(opts: PotatoOptions = {}): PotatoApp {
  const historyEnabled = opts.history !== false
  const hrefEnabled = opts.href !== false
  const hashMode = opts.hash === true
  const debug = opts.debug === true
  const throwOnHandlerError =
    opts.throwOnHandlerError ??
    (debug ||
      (typeof process !== "undefined" &&
        process.env?.NODE_ENV !== "production"))

  const emitter = createEmitter({ debug, throwOnError: throwOnHandlerError })
  const router = createRouter()
  const stores: Store[] = []

  let started = false
  let root: ReturnType<typeof createRoot> | null = null
  let mountTarget: Element | null = null

  const emit: Emit = (event, ...args) => emitter.emit(event, ...args)

  const state = createState(opts.initialState, () => state, emit, opts.cache ?? 100)

  // Built-in navigation handlers
  emitter.on(EVENTS.PUSHSTATE, (path?: unknown) => {
    const href = String(path ?? "/")
    if (typeof history !== "undefined" && historyEnabled) {
      history.pushState({}, "", href)
    }
    applyLocationTo(state, href)
    emit(EVENTS.NAVIGATE)
    emit(EVENTS.RENDER)
  })

  emitter.on(EVENTS.REPLACESTATE, (path?: unknown) => {
    const href = String(path ?? "/")
    if (typeof history !== "undefined" && historyEnabled) {
      history.replaceState({}, "", href)
    }
    applyLocationTo(state, href)
    emit(EVENTS.NAVIGATE)
    emit(EVENTS.RENDER)
  })

  emitter.on(EVENTS.POPSTATE, () => {
    applyLocationTo(state, currentUrl())
    emit(EVENTS.NAVIGATE)
    emit(EVENTS.RENDER)
  })

  emitter.on(EVENTS.DOMTITLECHANGE, (title?: unknown) => {
    state.title = String(title ?? "")
    if (typeof document !== "undefined") document.title = state.title
  })

  emitter.on(EVENTS.RENDER, () => {
    if (!started || !root) return
    const tree = renderView()
    if (tree != null) root.update(tree)
  })

  function currentUrl(): string {
    if (typeof location === "undefined") return state.href || "/"
    if (hashMode) return location.hash || "#/"
    return location.pathname + location.search
  }

  /** Apply routing fields onto a state bag (request-local or app). */
  function applyLocationTo(target: AppState, location: string): void {
    const { pathname, search, hash } = parseLocation(location)
    let pathForMatch = pathname
    if (hashMode) {
      const h = hash.startsWith("#") ? hash.slice(1) : hash
      pathForMatch = h.startsWith("/") ? h : `/${h || ""}`
    }
    const matched = router.match(pathForMatch + search, false)
    target.href = hashMode ? pathForMatch : pathname
    target.query = parseQuery(search)
    if (matched) {
      target.route = matched.route
      target.params = matched.params
    } else {
      target.route = ""
      target.params = {}
    }
  }

  function renderView() {
    const loc = state.href || "/"
    const matched = router.match(loc)
    if (!matched) {
      if (debug) console.warn(`[potato] no route for ${loc}`)
      return null
    }
    state.route = matched.route
    state.params = matched.params
    return matched.view(state, emit)
  }

  let storesRan = false
  function runStores(): void {
    if (storesRan) return
    storesRan = true
    for (const store of stores) {
      store(state, emitter, app)
    }
  }

  function attachBrowser(): void {
    if (typeof window === "undefined") return

    if (historyEnabled) {
      window.addEventListener("popstate", () => emit(EVENTS.POPSTATE))
    }

    if (hrefEnabled) {
      document.addEventListener("click", (e) => {
        const t = e.target as Element | null
        const a = t?.closest?.("a") as HTMLAnchorElement | null
        if (!a || !a.href) return
        if (e.defaultPrevented) return
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
        if (a.target && a.target !== "_self") return
        if (a.hasAttribute("download")) return
        if (a.protocol && a.protocol !== "http:" && a.protocol !== "https:" && a.protocol !== location.protocol) {
          // mailto:, etc.
          if (!["http:", "https:"].includes(a.protocol)) return
        }
        try {
          const url = new URL(a.href)
          if (url.origin !== location.origin) return
          e.preventDefault()
          const next = hashMode
            ? url.hash || "#/"
            : url.pathname + url.search
          emit(EVENTS.PUSHSTATE, next)
        } catch {
          /* ignore */
        }
      })
    }

    // Rehydrate from window.__POTATO_STATE__ or window.initialState (choo compat)
    const w = window as Window & {
      __POTATO_STATE__?: Partial<AppState>
      initialState?: Partial<AppState>
    }
    const boot = w.__POTATO_STATE__ ?? w.initialState
    if (boot) {
      Object.assign(state, boot)
      try {
        delete w.__POTATO_STATE__
        delete w.initialState
      } catch {
        /* ignore */
      }
    }

    applyLocationTo(state, currentUrl())
    emit(EVENTS.DOMCONTENTLOADED)
  }

  const app: PotatoApp = {
    state,
    emitter,

    use(store: Store) {
      if (started || storesRan) {
        store(state, emitter, app)
      } else {
        stores.push(store)
      }
      return app
    },

    route(path: string, view: View) {
      const wrappedView: View = (s, emit) => {
        const tree = view(s, emit)
        if (isVNode(tree) && tree.props.key == null) {
          const matchedRoute = s.route || path
          tree.props.key = `__potato_route_${matchedRoute}`
          tree.key = tree.props.key
        }
        return tree
      }
      router.add(path, wrappedView)
      return app
    },

    mount(selector: string | Element) {
      if (typeof document === "undefined") {
        // SSR: remember selector
        ;(app as PotatoApp & { selector?: string }).selector =
          typeof selector === "string" ? selector : ""
        return app
      }
      const el =
        typeof selector === "string"
          ? document.querySelector(selector)
          : selector
      if (!el) throw new Error(`[potato] mount target not found: ${selector}`)
      mountTarget = el
      app.start()
      return app
    },

    start() {
      if (started) {
        const tree = renderView()
        /* v8 ignore next 3 */
        if (!root || !mountTarget) {
          throw new Error("[potato] start() without mount target")
        }
        /* v8 ignore next */
        return root.root ?? (root.mount(mountTarget, tree), root.root!)
      }

      runStores()
      attachBrowser()

      /* v8 ignore next 3 */
      if (!mountTarget) {
        // Create detached root
        mountTarget = document.createElement("div")
      }

      root = createRoot({ state, emit })
      const tree = renderView()
      const el = root.mount(mountTarget, tree ?? { type: "div", props: {} })
      started = true
      return el
    },

    /**
     * Render a route to HTML using an **isolated state snapshot**.
     * Does not mutate `app.state` — safe for concurrent SSR / Live sessions.
     * Pass per-request overlays via `partial` (params, loader data, session bag).
     *
     * **Views must be pure:** `emit` during this render is always a no-op
     * (never hits the global emitter). Side effects belong in stores, loaders,
     * or Live `onEvent`.
     */
    toString(location: string, partial?: Partial<AppState>) {
      runStores()
      const pure = pureEmit({ debug })
      const snap = isolateStateForRender(state, partial, pure, opts.cache ?? 100)
      applyLocationTo(snap, location)
      const matched = router.match(snap.href)
      if (!matched) return ""
      snap.route = matched.route
      snap.params = matched.params
      const tree = matched.view(snap, pure)
      return renderToString(tree, { state: snap, emit: pure })
    },

    /**
     * Like `toString` but returns the VNode tree; does not mutate `app.state`.
     * Same pure-view rule: `emit` is a no-op and never reaches the global bus.
     */
    toVNode(location: string, partial?: Partial<AppState>) {
      runStores()
      const pure = pureEmit({ debug })
      const snap = isolateStateForRender(state, partial, pure, opts.cache ?? 100)
      applyLocationTo(snap, location)
      const matched = router.match(snap.href)
      if (!matched) return null
      snap.route = matched.route
      snap.params = matched.params
      return matched.view(snap, pure)
    },

    render() {
      emit(EVENTS.RENDER)
    },

    navigate(path: string, navOpts?: { replace?: boolean }) {
      emit(navOpts?.replace ? EVENTS.REPLACESTATE : EVENTS.PUSHSTATE, path)
    },

    routes() {
      return router.list()
    },

    match(location: string) {
      return router.match(location, hashMode)
    },
  }

  return app
}

function createState(
  initial: Partial<AppState> | undefined,
  getState: () => AppState,
  emit: Emit,
  cacheSize: number,
): AppState {
  const state = {
    events: EVENTS,
    params: {},
    query: {},
    href: "/",
    route: "/",
    title: "",
    cache: bindCache(cacheSize, getState, () => emit),
    ...initial,
  } as AppState
  // ensure events always present
  state.events = EVENTS
  state.cache = bindCache(cacheSize, getState, () => emit)
  return state
}

/**
 * Build a render-only state bag that does not share nested mutable refs with
 * the live app state. By default reuses framework `events` only — **not** the
 * live component cache (that closes over the real client `emit`).
 */
export function isolateState(
  base: AppState,
  partial?: Partial<AppState>,
): AppState {
  const { cache: _cache, events, ...rest } = base
  let plain: Record<string, unknown>
  try {
    plain = JSON.parse(JSON.stringify(rest)) as Record<string, unknown>
  } catch {
    plain = { ...rest }
    for (const k of Object.keys(plain)) {
      const v = plain[k]
      if (v && typeof v === "object") {
        plain[k] = Array.isArray(v) ? [...v] : { ...(v as object) }
      }
    }
  }
  const snap = {
    ...plain,
    ...(partial ?? {}),
    params: {
      ...((plain.params as Record<string, string>) ?? {}),
      ...(partial?.params ?? {}),
    },
    query: {
      ...((plain.query as Record<string, string>) ?? {}),
      ...(partial?.query ?? {}),
    },
    events,
    // Placeholder — pure renders replace this with a render-local cache
    cache: base.cache,
  } as AppState
  return snap
}

/**
 * Snapshot + **render-local cache** bound to `pure` emit so component trees
 * cannot reach the global emitter during SSR / toString.
 */
export function isolateStateForRender(
  base: AppState,
  partial: Partial<AppState> | undefined,
  pure: Emit,
  cacheSize: number,
): AppState {
  const snap = isolateState(base, partial)
  snap.cache = bindCache(cacheSize, () => snap, () => pure)
  return snap
}

export type PureEmitOptions = {
  /** Force warnings (default: debug or non-production) */
  debug?: boolean
  warn?: boolean
}

/**
 * Emit used while rendering views (SSR / toString / toVNode).
 * Product rule: views are pure — only read `state` and return VNodes.
 * **Never** forwards to the global emitter. Warns in dev when misused.
 */
export function pureEmit(opts: boolean | PureEmitOptions = false): Emit {
  const o: PureEmitOptions =
    typeof opts === "boolean" ? { debug: opts } : opts
  const warn =
    o.warn ??
    (o.debug === true ||
      (typeof process !== "undefined" &&
        process.env?.NODE_ENV !== "production"))
  const warned = new Set<string>()
  return (event: string, ..._args: unknown[]) => {
    if (!warn) return
    if (warned.has(event)) return
    warned.add(event)
    console.warn(
      `[potato] emit('${event}') during render is a no-op — views must be pure (use stores / loaders / Live onEvent)`,
    )
  }
}


