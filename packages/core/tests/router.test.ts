import { describe, expect, it } from "vitest"
import { createRouter, parseLocation, parseQuery } from "../src/router.js"
import type { View } from "../src/types.js"

const view: View = () => null

describe("createRouter", () => {
  it("matches static routes", () => {
    const r = createRouter()
    r.add("/", view)
    r.add("/about", view)
    expect(r.match("/")?.route).toBe("/")
    expect(r.match("/about")?.route).toBe("/about")
    expect(r.match("/nope")).toBeNull()
  })

  it("extracts params", () => {
    const r = createRouter()
    r.add("/users/:id", view)
    r.add("/posts/:slug/comments/:cid", view)
    expect(r.match("/users/42")?.params).toEqual({ id: "42" })
    expect(r.match("/posts/hello-world/comments/9")?.params).toEqual({
      slug: "hello-world",
      cid: "9",
    })
  })

  it("supports wildcards and fallback *", () => {
    const r = createRouter()
    r.add("/files/*", view)
    r.add("*", view)
    expect(r.match("/files/a/b")?.params.wildcard).toBe("a/b")
    expect(r.match("/missing")?.route).toBe("*")
  })

  it("ignores query string in match path via parseLocation", () => {
    const r = createRouter()
    r.add("/search", view)
    const { pathname, search } = parseLocation("/search?q=potato")
    expect(pathname).toBe("/search")
    expect(parseQuery(search)).toEqual({ q: "potato" })
    expect(r.match(pathname)?.route).toBe("/search")
  })
})

describe("parseQuery / parseLocation", () => {
  it("parses multi params and empty", () => {
    expect(parseQuery("?a=1&b=two")).toEqual({ a: "1", b: "two" })
    expect(parseQuery("")).toEqual({})
  })

  it("parses hash and search", () => {
    const loc = parseLocation("/app?x=1#section")
    expect(loc.pathname).toBe("/app")
    expect(loc.search).toBe("?x=1")
    expect(loc.hash).toBe("#section")
  })
})
