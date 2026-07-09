import type { RouteMatch, View } from "./types.js"

export interface RouteEntry {
  path: string
  view: View
  /** Compiled segment matchers */
  parts: Part[]
}

type Part =
  | { kind: "static"; value: string }
  | { kind: "param"; name: string }
  | { kind: "wildcard"; name: string }

function compile(path: string): Part[] {
  const cleaned = path.replace(/\/+/g, "/").replace(/\/$/, "") || "/"
  if (cleaned === "*") return [{ kind: "wildcard", name: "wildcard" }]
  if (cleaned === "/") return [{ kind: "static", value: "" }]

  return cleaned
    .slice(1)
    .split("/")
    .map((seg): Part => {
      if (seg === "*") return { kind: "wildcard", name: "wildcard" }
      if (seg.startsWith(":")) return { kind: "param", name: seg.slice(1) }
      return { kind: "static", value: seg }
    })
}

function matchParts(
  parts: Part[],
  pathname: string,
): Record<string, string> | null {
  const path = pathname.replace(/\/+/g, "/").replace(/\/$/, "") || "/"
  if (parts.length === 1 && parts[0]?.kind === "wildcard") {
    return { wildcard: path === "/" ? "" : path.slice(1) }
  }

  const segs = path === "/" ? [""] : path.slice(1).split("/")
  const params: Record<string, string> = {}
  let i = 0
  let j = 0

  while (i < parts.length && j < segs.length) {
    const part = parts[i]!
    const seg = segs[j]!
    if (part.kind === "static") {
      if (part.value !== seg) return null
      i++
      j++
    } else if (part.kind === "param") {
      params[part.name] = decodeURIComponent(seg)
      i++
      j++
    } else {
      params[part.name] = segs.slice(j).map(decodeURIComponent).join("/")
      return params
    }
  }

  // trailing wildcard empty
  if (i < parts.length && parts[i]?.kind === "wildcard") {
    params[(parts[i] as { name: string }).name] = ""
    i++
  }

  if (i !== parts.length || j !== segs.length) return null
  return params
}

export function parseQuery(search: string): Record<string, string> {
  const q = search.startsWith("?") ? search.slice(1) : search
  if (!q) return {}
  const out: Record<string, string> = {}
  for (const pair of q.split("&")) {
    if (!pair) continue
    const [k, ...rest] = pair.split("=")
    if (!k) continue
    out[decodeURIComponent(k)] = decodeURIComponent(rest.join("=") ?? "")
  }
  return out
}

export function parseLocation(location: string): {
  pathname: string
  search: string
  hash: string
} {
  // Accept path-only or full-ish URLs
  try {
    if (location.includes("://")) {
      const u = new URL(location)
      return { pathname: u.pathname, search: u.search, hash: u.hash }
    }
  } catch {
    /* fall through */
  }
  const hashIdx = location.indexOf("#")
  const hash = hashIdx >= 0 ? location.slice(hashIdx) : ""
  const withoutHash = hashIdx >= 0 ? location.slice(0, hashIdx) : location
  const qIdx = withoutHash.indexOf("?")
  const search = qIdx >= 0 ? withoutHash.slice(qIdx) : ""
  const pathname = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash
  return { pathname: pathname || "/", search, hash }
}

export function createRouter() {
  const routes: RouteEntry[] = []
  let fallback: RouteEntry | null = null

  const add = (path: string, view: View): void => {
    const entry: RouteEntry = { path, view, parts: compile(path) }
    if (path === "*" || path === "/*") {
      fallback = entry
      return
    }
    routes.push(entry)
  }

  const match = (location: string, hashMode = false): RouteMatch | null => {
    let { pathname, hash } = parseLocation(location)
    if (hashMode && hash) {
      // /#/foo → /foo
      const h = hash.startsWith("#") ? hash.slice(1) : hash
      pathname = h.startsWith("/") ? h : `/${h}`
    }
    for (const r of routes) {
      const params = matchParts(r.parts, pathname)
      if (params) {
        return { route: r.path, params, view: r.view }
      }
    }
    if (fallback) {
      return {
        route: fallback.path,
        params: { wildcard: pathname.slice(1) },
        view: fallback.view,
      }
    }
    return null
  }

  const list = () =>
    [
      ...routes.map((r) => ({ path: r.path, view: r.view })),
      ...(fallback ? [{ path: fallback.path, view: fallback.view }] : []),
    ] as const

  return { add, match, list }
}
