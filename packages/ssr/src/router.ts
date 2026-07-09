import type { ApiRoute, HttpMethod } from "./context.js"

export interface CompiledApi {
  route: ApiRoute
  parts: Array<
    | { kind: "static"; value: string }
    | { kind: "param"; name: string }
    | { kind: "wildcard" }
  >
}

export function compileApiPath(path: string): CompiledApi["parts"] {
  /* v8 ignore next 3 */
  const cleaned = path.replace(/\/+/g, "/").replace(/\/$/, "") || "/"
  if (cleaned === "/") return [{ kind: "static", value: "" }]
  return cleaned
    .slice(1)
    .split("/")
    .map((seg) => {
      if (seg === "*") return { kind: "wildcard" as const }
      if (seg.startsWith(":")) return { kind: "param" as const, name: seg.slice(1) }
      return { kind: "static" as const, value: seg }
    })
}

export function matchApi(
  routes: CompiledApi[],
  method: HttpMethod,
  pathname: string,
): { route: ApiRoute; params: Record<string, string> } | null {
  const segs =
    pathname === "/" ? [""] : pathname.replace(/\/$/, "").slice(1).split("/")

  for (const { route, parts } of routes) {
    if (route.method !== "*" && route.method !== method) continue
    const params: Record<string, string> = {}
    let i = 0
    let j = 0
    let ok = true
    while (i < parts.length && j < segs.length) {
      const p = parts[i]!
      const s = segs[j]!
      if (p.kind === "static") {
        if (p.value !== s) {
          ok = false
          break
        }
        i++
        j++
      } else if (p.kind === "param") {
        params[p.name] = decodeURIComponent(s)
        i++
        j++
      } else {
        params["*"] = segs.slice(j).join("/")
        j = segs.length
        i = parts.length
      }
    }
    if (!ok) continue
    if (i === parts.length && j === segs.length) {
      return { route, params }
    }
  }
  return null
}
