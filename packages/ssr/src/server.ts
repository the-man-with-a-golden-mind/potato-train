import type { PotatoApp } from "@potato/core"
import { Effect } from "effect"
import {
  createContext,
  type ApiHandler,
  type ApiRoute,
  type HttpMethod,
  type Middleware,
  type PageLoader,
  type PotatoContext,
} from "./context.js"
import { documentHtml, type DocumentOptions } from "./document.js"
import { compileApiPath, matchApi, type CompiledApi } from "./router.js"

export interface ServerOptions {
  app: PotatoApp
  /** Global middleware (auth, logging, cors, …) */
  middleware?: Middleware[]
  /** Document shell options */
  document?: DocumentOptions | ((ctx: PotatoContext) => DocumentOptions)
  /** Client bundle URL for hydration */
  clientEntry?: string
  /** Enable LiveView endpoint path (default /__potato/live) */
  live?: boolean | string
  /** Not-found handler */
  notFound?: (ctx: PotatoContext) => Response | Promise<Response>
  /** Error handler */
  onError?: (err: unknown, ctx: PotatoContext) => Response | Promise<Response>
  /** Platform env injector */
  env?: Record<string, unknown> | ((req: Request) => Record<string, unknown>)
}

export interface PotatoServer {
  use(mw: Middleware): PotatoServer
  api(method: HttpMethod | "*", path: string, handler: ApiHandler): PotatoServer
  get(path: string, handler: ApiHandler): PotatoServer
  post(path: string, handler: ApiHandler): PotatoServer
  put(path: string, handler: ApiHandler): PotatoServer
  patch(path: string, handler: ApiHandler): PotatoServer
  delete(path: string, handler: ApiHandler): PotatoServer
  /** Attach a load() for a page path (like getServerSideProps) */
  page(path: string, load: PageLoader): PotatoServer
  fetch(req: Request, env?: Record<string, unknown>): Promise<Response>
  /** Effect-friendly handler */
  effect(req: Request, env?: Record<string, unknown>): Effect.Effect<Response, unknown>
  /** Node: listen with built-in http (dynamic import) */
  listen(port: number, hostname?: string): Promise<{ close: () => void; url: string }>
}

/**
 * Create a Next-style request handler around a Potato app.
 *
 * @example
 * ```ts
 * const server = createServer({ app, clientEntry: '/assets/client.js' })
 * server.get('/api/health', () => ({ ok: true }))
 * server.use(authMiddleware)
 * export default { fetch: (req, env) => server.fetch(req, env) }
 * ```
 */
export function createServer(opts: ServerOptions): PotatoServer {
  const middleware: Middleware[] = [...(opts.middleware ?? [])]
  const apis: CompiledApi[] = []
  const pageLoads = new Map<string, PageLoader>()

  const server: PotatoServer = {
    use(mw) {
      middleware.push(mw)
      return server
    },

    api(method, path, handler) {
      apis.push({
        route: { method, path, handler },
        parts: compileApiPath(path),
      })
      return server
    },

    get(path, handler) {
      return server.api("GET", path, handler)
    },
    post(path, handler) {
      return server.api("POST", path, handler)
    },
    put(path, handler) {
      return server.api("PUT", path, handler)
    },
    patch(path, handler) {
      return server.api("PATCH", path, handler)
    },
    delete(path, handler) {
      return server.api("DELETE", path, handler)
    },

    page(path, load) {
      pageLoads.set(path, load)
      return server
    },

    async fetch(req, envOverride) {
      const envBase =
        typeof opts.env === "function"
          ? opts.env(req)
          : (opts.env ?? {})
      const env = { ...envBase, ...envOverride }
      const ctx = createContext(req, opts.app, env)

      try {
        return await runPipeline(ctx, middleware, async () => {
          // API routes first
          const apiHit = matchApi(apis, ctx.method, ctx.url.pathname)
          if (apiHit) {
            ctx.params = apiHit.params
            const result = await apiHit.route.handler(ctx)
            if (result instanceof Response) return result
            if (result === undefined) return ctx.text("", 204)
            return ctx.json(result)
          }

          // Page SSR
          const matched = opts.app.match(ctx.url.pathname + ctx.url.search)
          if (!matched) {
            if (opts.notFound) return opts.notFound(ctx)
            return ctx.text("Not Found", 404)
          }

          ctx.params = matched.params
          ctx.state.params = matched.params
          ctx.state.href = ctx.url.pathname
          ctx.state.route = matched.route
          ctx.state.query = ctx.query

          const loader =
            pageLoads.get(matched.route) ?? pageLoads.get(ctx.url.pathname)
          if (loader) {
            const patch = await loader(ctx)
            if (patch) Object.assign(ctx.state, patch)
          }

          const htmlBody = opts.app.toString(
            ctx.url.pathname + ctx.url.search,
            ctx.state,
          )

          // Stores run during toString — pick up latest app state for rehydration
          Object.assign(ctx.state, opts.app.state, {
            params: ctx.params,
            query: ctx.query,
            href: ctx.url.pathname,
            route: matched.route,
          })

          const docOpts: DocumentOptions = {
            clientEntry: opts.clientEntry,
            livePath:
              opts.live === false
                ? undefined
                : typeof opts.live === "string"
                  ? opts.live
                  : "/__potato/live",
            state: sanitizeState(ctx.state),
            title: String(ctx.state.title ?? ""),
            ...(typeof opts.document === "function"
              ? opts.document(ctx)
              : (opts.document ?? {})),
          }

          return ctx.html(documentHtml(htmlBody, docOpts))
        })
      } catch (err) {
        if (opts.onError) return opts.onError(err, ctx)
        console.error("[potato/ssr]", err)
        return new Response("Internal Server Error", { status: 500 })
      }
    },

    effect(req, env) {
      return Effect.tryPromise({
        try: () => server.fetch(req, env),
        catch: (e) => e,
      })
    },

    async listen(port, hostname = "0.0.0.0") {
      const { createServer: createHttpServer } = await import("node:http")
      const httpServer = createHttpServer(async (nodeReq, nodeRes) => {
        try {
          const host = nodeReq.headers.host ?? `${hostname}:${port}`
          const url = `http://${host}${nodeReq.url ?? "/"}`
          const headers = new Headers()
          for (const [k, v] of Object.entries(nodeReq.headers)) {
            if (v == null) continue
            if (Array.isArray(v)) v.forEach((x) => headers.append(k, x))
            else headers.set(k, v)
          }
          const chunks: Buffer[] = []
          for await (const chunk of nodeReq) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
          }
          const body =
            nodeReq.method === "GET" || nodeReq.method === "HEAD"
              ? undefined
              : Buffer.concat(chunks)
          const req = new Request(url, {
            method: nodeReq.method,
            headers,
            body: body?.length ? new Uint8Array(body) : undefined,
          })
          const res = await server.fetch(req)
          nodeRes.statusCode = res.status
          res.headers.forEach((v, k) => {
            if (k === "set-cookie") {
              // multi set-cookie handled by getSetCookie if available
            }
            nodeRes.setHeader(k, v)
          })
          if (typeof res.headers.getSetCookie === "function") {
            const cookies = res.headers.getSetCookie()
            if (cookies.length) nodeRes.setHeader("set-cookie", cookies)
          }
          const buf = Buffer.from(await res.arrayBuffer())
          nodeRes.end(buf)
        } catch (err) {
          console.error(err)
          nodeRes.statusCode = 500
          nodeRes.end("Internal Server Error")
        }
      })

      await new Promise<void>((resolve) => {
        httpServer.listen(port, hostname, () => resolve())
      })
      const url = `http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port}`
      console.log(`[potato] listening on ${url}`)
      return {
        url,
        close: () => httpServer.close(),
      }
    },
  }

  return server
}

async function runPipeline(
  ctx: PotatoContext,
  mws: Middleware[],
  final: () => Promise<Response>,
): Promise<Response> {
  let i = 0
  const next = async (): Promise<Response> => {
    if (i >= mws.length) return final()
    const mw = mws[i++]!
    return mw(ctx, next)
  }
  return next()
}

function sanitizeState(state: Record<string, unknown>): Record<string, unknown> {
  // Drop non-serializable bits (cache, functions, events object is fine)
  const { cache: _c, ...rest } = state as {
    cache?: unknown
    [k: string]: unknown
  }
  return JSON.parse(JSON.stringify(rest)) as Record<string, unknown>
}

/** Compose middleware left-to-right. */
export function compose(mws: Middleware[]): Middleware {
  return async (ctx, next) => {
    let i = 0
    const run = async (): Promise<Response> => {
      if (i >= mws.length) return next()
      const mw = mws[i++]!
      return mw(ctx, run)
    }
    return run()
  }
}

/** CORS middleware helper. */
export function cors(
  options: {
    origin?: string | string[] | ((origin: string) => boolean)
    methods?: string[]
    headers?: string[]
    credentials?: boolean
  } = {},
): Middleware {
  return async (ctx, next) => {
    const origin = ctx.req.headers.get("origin") ?? "*"
    let allow = "*"
    if (typeof options.origin === "string") allow = options.origin
    else if (Array.isArray(options.origin)) {
      allow = options.origin.includes(origin) ? origin : options.origin[0] ?? "*"
    } else if (typeof options.origin === "function") {
      allow = options.origin(origin) ? origin : "null"
    } else {
      allow = origin === "null" ? "*" : origin
    }
    ctx.headers.set("access-control-allow-origin", allow)
    if (options.credentials) {
      ctx.headers.set("access-control-allow-credentials", "true")
    }
    ctx.headers.set(
      "access-control-allow-methods",
      (options.methods ?? ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]).join(
        ", ",
      ),
    )
    ctx.headers.set(
      "access-control-allow-headers",
      (options.headers ?? ["Content-Type", "Authorization"]).join(", "),
    )
    if (ctx.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: ctx.headers })
    }
    return next()
  }
}

/** Simple logger middleware. */
export function logger(): Middleware {
  return async (ctx, next) => {
    const start = Date.now()
    const res = await next()
    const ms = Date.now() - start
    console.log(
      `[potato] ${ctx.method} ${ctx.url.pathname} → ${res.status} ${ms}ms`,
    )
    return res
  }
}
