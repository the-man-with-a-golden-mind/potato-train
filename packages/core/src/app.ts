import { bindCache, Component } from "./cache.js"
import { createEmitter } from "./emitter.js"
import { EVENTS } from "./events.js"
import { createRoot, renderToString } from "./morph.js"
import { createRouter, parseLocation, parseQuery } from "./router.js"
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

  const emitter = createEmitter(debug)
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
    applyLocation(href)
    emit(EVENTS.NAVIGATE)
    emit(EVENTS.RENDER)
  })

  emitter.on(EVENTS.REPLACESTATE, (path?: unknown) => {
    const href = String(path ?? "/")
    if (typeof history !== "undefined" && historyEnabled) {
      history.replaceState({}, "", href)
    }
    applyLocation(href)
    emit(EVENTS.NAVIGATE)
    emit(EVENTS.RENDER)
  })

  emitter.on(EVENTS.POPSTATE, () => {
    applyLocation(currentUrl())
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

  function applyLocation(location: string): void {
    const { pathname, search, hash } = parseLocation(location)
    let pathForMatch = pathname
    if (hashMode) {
      const h = hash.startsWith("#") ? hash.slice(1) : hash
      pathForMatch = h.startsWith("/") ? h : `/${h || ""}`
    }
    const matched = router.match(pathForMatch + search, false)
    state.href = hashMode ? pathForMatch : pathname
    state.query = parseQuery(search)
    if (matched) {
      state.route = matched.route
      state.params = matched.params
    } else {
      state.route = ""
      state.params = {}
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

    applyLocation(currentUrl())
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
      router.add(path, view)
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

    toString(location: string, partial?: Partial<AppState>) {
      runStores()
      const prev = {
        href: state.href,
        route: state.route,
        params: { ...state.params },
        query: { ...state.query },
        title: state.title,
      }
      const partialKeys = partial ? Object.keys(partial) : []
      const prevPartial: Record<string, unknown> = {}
      for (const k of partialKeys) {
        prevPartial[k] = state[k]
      }
      if (partial) Object.assign(state, partial)
      applyLocation(location)
      const matched = router.match(state.href)
      if (!matched) {
        Object.assign(state, prev)
        Object.assign(state, prevPartial)
        return ""
      }
      const tree = matched.view(state, emit)
      const html = renderToString(tree, { state, emit })
      Object.assign(state, prev)
      Object.assign(state, prevPartial)
      return html
    },

    toVNode(location: string, partial?: Partial<AppState>) {
      runStores()
      const prev = {
        href: state.href,
        route: state.route,
        params: { ...state.params },
        query: { ...state.query },
      }
      if (partial) Object.assign(state, partial)
      applyLocation(location)
      const matched = router.match(state.href)
      const tree = matched ? matched.view(state, emit) : null
      Object.assign(state, prev)
      return tree
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


