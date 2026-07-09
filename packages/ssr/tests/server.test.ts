import { describe, expect, it } from "vitest"
import { potato, h } from "@potato/core"
import { createServer, cors, compose } from "../src/index.js"

describe("createServer", () => {
  it("serves API json", async () => {
    const app = potato()
    app.route("/", () => h("div", null, "hi"))
    const server = createServer({ app })
    server.get("/api/ping", () => ({ pong: true }))
    const res = await server.fetch(new Request("http://x/api/ping"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ pong: true })
  })

  it("ssr renders html document", async () => {
    const app = potato()
    app.route("/", () => h("h1", null, "Potato"))
    const server = createServer({
      app,
      document: { title: "T" },
    })
    const res = await server.fetch(new Request("http://x/"))
    const html = await res.text()
    expect(res.headers.get("content-type")).toContain("text/html")
    expect(html).toContain("<h1>Potato</h1>")
    expect(html).toContain("__POTATO_STATE__")
  })

  it("middleware order", async () => {
    const app = potato()
    app.route("/", () => h("div", null, "x"))
    const order: string[] = []
    const server = createServer({
      app,
      middleware: [
        async (_c, next) => {
          order.push("a")
          return next()
        },
        async (_c, next) => {
          order.push("b")
          return next()
        },
      ],
    })
    server.get("/api/x", () => {
      order.push("h")
      return { ok: 1 }
    })
    await server.fetch(new Request("http://x/api/x"))
    expect(order).toEqual(["a", "b", "h"])
  })

  it("cors preflight", async () => {
    const app = potato()
    const server = createServer({ app, middleware: [cors()] })
    server.get("/api/z", () => ({}))
    const res = await server.fetch(
      new Request("http://x/api/z", { method: "OPTIONS" }),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy()
  })

  it("compose helper", async () => {
    const hits: string[] = []
    const mw = compose([
      async (_c, n) => {
        hits.push("1")
        return n()
      },
      async (_c, n) => {
        hits.push("2")
        return n()
      },
    ])
    const app = potato()
    const server = createServer({ app, middleware: [mw] })
    server.get("/api/c", () => {
      hits.push("3")
      return {}
    })
    await server.fetch(new Request("http://x/api/c"))
    expect(hits).toEqual(["1", "2", "3"])
  })

  it("404 when no route", async () => {
    const app = potato()
    const server = createServer({ app })
    const res = await server.fetch(new Request("http://x/missing"))
    expect(res.status).toBe(404)
  })

  it("PATCH field update style API", async () => {
    const store = new Map<string, string>([["A1", "10"]])
    const app = potato()
    const server = createServer({ app })
    server.patch("/api/cells/:key", async (ctx) => {
      const body = (await ctx.req.json()) as { value: string }
      store.set(ctx.params.key!, body.value)
      return { key: ctx.params.key, value: body.value }
    })
    const res = await server.fetch(
      new Request("http://x/api/cells/A1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "=1+2" }),
      }),
    )
    expect(await res.json()).toEqual({ key: "A1", value: "=1+2" })
    expect(store.get("A1")).toBe("=1+2")
  })
})
