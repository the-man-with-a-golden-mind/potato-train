import type { AppState, PotatoApp } from "@potato/core"

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD"

export interface CookieOptions {
  path?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "strict" | "lax" | "none"
  maxAge?: number
  expires?: Date
  domain?: string
}

/** Request-scoped context for SSR / API / middleware. */
export interface PotatoContext {
  req: Request
  url: URL
  method: HttpMethod
  params: Record<string, string>
  query: Record<string, string>
  /** Mutable response headers */
  headers: Headers
  /** Status code (default 200) */
  status: number
  /** Shared bag for middleware (auth user, db, etc.) */
  locals: Record<string, unknown>
  /** Cookies helpers */
  cookies: {
    get(name: string): string | undefined
    set(name: string, value: string, opts?: CookieOptions): void
    delete(name: string): void
  }
  /** Application instance */
  app: PotatoApp
  /** Clone state for this render */
  state: AppState
  /** Platform env (Cloudflare env, process.env, etc.) */
  env: Record<string, unknown>
  json(data: unknown, init?: number | ResponseInit): Response
  text(body: string, init?: number | ResponseInit): Response
  html(body: string, init?: number | ResponseInit): Response
  redirect(location: string, status?: number): Response
}

export type Middleware = (
  ctx: PotatoContext,
  next: () => Promise<Response>,
) => Promise<Response> | Response

export type ApiHandler = (
  ctx: PotatoContext,
) => Promise<Response | unknown> | Response | unknown

export type PageLoader = (
  ctx: PotatoContext,
) => Promise<Partial<AppState> | void> | Partial<AppState> | void

export interface ApiRoute {
  method: HttpMethod | "*"
  path: string
  handler: ApiHandler
}

export interface PageRoute {
  path: string
  load?: PageLoader
  /** Optional layout wrapper */
  layout?: (html: string, ctx: PotatoContext) => string | Promise<string>
}

export function createContext(
  req: Request,
  app: PotatoApp,
  env: Record<string, unknown> = {},
  params: Record<string, string> = {},
): PotatoContext {
  const url = new URL(req.url)
  const headers = new Headers()
  const cookieJar = parseCookieHeader(req.headers.get("cookie") ?? "")
  const setCookies: string[] = []

  const query: Record<string, string> = {}
  url.searchParams.forEach((v, k) => {
    query[k] = v
  })

  const state = { ...app.state, params, query, href: url.pathname }

  const applyInit = (init?: number | ResponseInit): ResponseInit => {
    if (typeof init === "number") {
      return { status: init, headers }
    }
    const h = new Headers(headers)
    if (init?.headers) {
      new Headers(init.headers).forEach((v, k) => h.set(k, v))
    }
      for (const c of setCookies) {
      // undici: multiple Set-Cookie via append; some runtimes hide from .get()
      h.append("set-cookie", c)
    }
    return { ...init, status: init?.status ?? ctx.status, headers: h }
  }

  const ctx: PotatoContext = {
    req,
    url,
    method: req.method.toUpperCase() as HttpMethod,
    params,
    query,
    headers,
    status: 200,
    locals: {},
    env,
    app,
    state,
    cookies: {
      get: (name) => cookieJar[name],
      set: (name, value, opts = {}) => {
        setCookies.push(serializeCookie(name, value, opts))
      },
      delete: (name) => {
        setCookies.push(
          serializeCookie(name, "", { path: "/", maxAge: 0 }),
        )
      },
    },
    json(data, init) {
      headers.set("content-type", "application/json; charset=utf-8")
      const conf = applyInit(init)
      if (conf.status === 204 || conf.status === 205) {
        return new Response(null, conf)
      }
      return new Response(JSON.stringify(data), conf)
    },
    text(body, init) {
      headers.set("content-type", "text/plain; charset=utf-8")
      const conf = applyInit(init)
      if (conf.status === 204 || conf.status === 205) {
        return new Response(null, conf)
      }
      return new Response(body, conf)
    },
    html(body, init) {
      headers.set("content-type", "text/html; charset=utf-8")
      const conf = applyInit(init)
      if (conf.status === 204 || conf.status === 205) {
        return new Response(null, conf)
      }
      return new Response(body, conf)
    },
    redirect(location, status = 302) {
      headers.set("location", location)
      return new Response(null, applyInit({ status }))
    },
  }

  return ctx
}

function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=")
    if (!k) continue
    out[k] = decodeURIComponent(rest.join("=") ?? "")
  }
  return out
}

function serializeCookie(
  name: string,
  value: string,
  opts: CookieOptions,
): string {
  let s = `${name}=${encodeURIComponent(value)}`
  if (opts.maxAge != null) s += `; Max-Age=${opts.maxAge}`
  if (opts.expires) s += `; Expires=${opts.expires.toUTCString()}`
  if (opts.domain) s += `; Domain=${opts.domain}`
  s += `; Path=${opts.path ?? "/"}`
  if (opts.httpOnly) s += "; HttpOnly"
  if (opts.secure) s += "; Secure"
  if (opts.sameSite) s += `; SameSite=${opts.sameSite}`
  return s
}
