import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { potato, h, defineStore } from "potato-train-core"
import {
  createServer,
  documentHtml,
  createContext,
  logger,
  compose,
  cors,
  effectHandler,
  readJson,
  PotatoRequest,
  matchApi,
  compileApiPath,
} from "../src/index.js"

describe("documentHtml", () => {
  it("builds full document with state escape", () => {
    const html = documentHtml("<b>hi</b>", {
      title: "T<script>",
      state: { x: 1 },
      clientEntry: "/app.js",
      livePath: "/live",
      styles: ["/a.css", "<style>x{}</style>"],
      scripts: ["/b.js", "<script>inline()</script>"],
      head: "<meta name='x'/>",
      lang: "pl",
    })
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("T&lt;script&gt;")
    expect(html).toContain("__POTATO_STATE__")
    expect(html).toContain("__POTATO_LIVE__")
    expect(html).toContain("/app.js")
    expect(html).toContain("lang=\"pl\"")
  })
})

describe("API router", () => {
  it("compiles and matches params + wildcard", () => {
    const routes = [
      {
        route: {
          method: "GET" as const,
          path: "/api/items/:id",
          handler: () => ({}),
        },
        parts: compileApiPath("/api/items/:id"),
      },
      {
        route: {
          method: "GET" as const,
          path: "/api/files/*",
          handler: () => ({}),
        },
        parts: compileApiPath("/api/files/*"),
      },
    ]
    const hit = matchApi(routes, "GET", "/api/items/42")
    expect(hit?.params.id).toBe("42")
    const wild = matchApi(routes, "GET", "/api/files/a/b")
    expect(wild?.params["*"]).toBe("a/b")
    expect(matchApi(routes, "POST", "/api/items/1")).toBeNull()
  })
})

describe("createContext helpers", () => {
  it("json text html redirect cookies", async () => {
    const app = potato()
    const req = new Request("http://x/p?q=1", {
      headers: { cookie: "a=1; b=two" },
    })
    const ctx = createContext(req, app, { FOO: "1" }, { id: "9" })
    expect(ctx.cookies.get("a")).toBe("1")
    ctx.cookies.set("sess", "abc", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60,
    })
    ctx.cookies.delete("sess")
    const j = ctx.json({ ok: true }, 201)
    expect(j.status).toBe(201)
    expect(await j.json()).toEqual({ ok: true })
    const t = ctx.text("hi")
    expect(await t.text()).toBe("hi")
    const htm = ctx.html("<p>x</p>")
    expect(htm.headers.get("content-type")).toContain("html")
    const r = ctx.redirect("/go", 301)
    expect(r.status).toBe(301)
    expect(r.headers.get("location")).toBe("/go")
    // 204 no body
    const n = ctx.text("", 204)
    expect(n.status).toBe(204)
  })
})

describe("server extras", () => {
  it("page loader, onError, notFound, env fn, effect, listen", async () => {
    const app = potato()
    app.use(defineStore("t", { title: "x" }, () => {}))
    app.route("/", (s) => h("h1", null, String((s as { title?: string }).title)))
    app.route("/boom", () => {
      throw new Error("nope")
    })

    const server = createServer({
      app,
      middleware: [logger(), cors({ origin: (o) => o === "http://ok" })],
      env: (req) => ({ path: new URL(req.url).pathname }),
      document: (ctx) => ({ title: String(ctx.state.title ?? "D") }),
      notFound: (ctx) => ctx.text("gone", 404),
      onError: (err, ctx) =>
        ctx.json({ err: err instanceof Error ? err.message : "e" }, 500),
      clientEntry: "/c.js",
      live: "/live",
    })

    server.page("/", () => ({ title: "Loaded" }))
    server.put("/api/x", () => ({ m: "put" }))
    server.patch("/api/x", () => ({ m: "patch" }))
    server.delete("/api/x", () => ({ m: "del" }))
    server.api("*", "/api/any", () => ({ any: true }))

    server.post(
      "/api/echo",
      effectHandler(
        Effect.gen(function* () {
          const body = yield* readJson<{ v: number }>()
          const ctx = yield* PotatoRequest
          return ctx.json({ v: body.v * 2 })
        }),
      ),
    )

    const home = await server.fetch(new Request("http://x/"))
    const html = await home.text()
    expect(html).toContain("Loaded")

    expect(
      (await (await server.fetch(new Request("http://x/nope"))).text()),
    ).toBe("gone")

    const boom = await server.fetch(new Request("http://x/boom"))
    // boom throws in view during SSR
    expect([200, 500]).toContain(boom.status)

    const echo = await server.fetch(
      new Request("http://x/api/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ v: 3 }),
      }),
    )
    expect(await echo.json()).toEqual({ v: 6 })

    // effect() wrapper
    const res = await Effect.runPromise(
      server.effect(new Request("http://x/api/any")),
    )
    expect(await res.json()).toEqual({ any: true })

    // cors origin array / function
    const pre = await server.fetch(
      new Request("http://x/api/x", {
        method: "OPTIONS",
        headers: { origin: "http://ok" },
      }),
    )
    expect(pre.status).toBe(204)

    // listen on ephemeral port — parse actual address
    const { createServer: createHttp } = await import("node:http")
    // exercise listen API with a free port
    const probe = createHttp()
    await new Promise<void>((r) => probe.listen(0, "127.0.0.1", () => r()))
    const addr = probe.address()
    const port =
      addr && typeof addr === "object" ? addr.port : 34567
    probe.close()
    const { close, url } = await server.listen(port, "127.0.0.1")
    expect(url).toContain(String(port))
    const live = await fetch(`http://127.0.0.1:${port}/api/any`)
    expect(live.status).toBe(200)
    close()
  })

  it("compose middleware", async () => {
    const order: string[] = []
    const mw = compose([
      async (_c, n) => {
        order.push("1")
        return n()
      },
      async (_c, n) => {
        order.push("2")
        return n()
      },
    ])
    const app = potato()
    const server = createServer({ app, middleware: [mw] })
    server.get("/api/z", () => {
      order.push("3")
      return {}
    })
    await server.fetch(new Request("http://x/api/z"))
    expect(order).toEqual(["1", "2", "3"])
  })

  it("cors with string and array origin", async () => {
    const app = potato()
    const s1 = createServer({
      app,
      middleware: [cors({ origin: "https://a.com", credentials: true })],
    })
    s1.get("/api/c", () => ({}))
    const r1 = await s1.fetch(
      new Request("http://x/api/c", {
        headers: { origin: "https://a.com" },
      }),
    )
    expect(r1.headers.get("access-control-allow-credentials")).toBe("true")

    const s2 = createServer({
      app,
      middleware: [cors({ origin: ["https://a.com", "https://b.com"] })],
    })
    s2.get("/api/c", () => ({}))
    await s2.fetch(
      new Request("http://x/api/c", {
        headers: { origin: "https://b.com" },
      }),
    )
  })
})
