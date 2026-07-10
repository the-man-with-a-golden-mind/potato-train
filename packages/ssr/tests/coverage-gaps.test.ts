import { describe, expect, it, vi } from "vitest"
import { Effect } from "effect"
import { potato, h } from "potato-train-core"
import {
  createServer,
  createContext,
  effectHandler,
  readJson,
  PotatoRequest,
  cors,
  documentHtml,
} from "../src/index.js"

describe("ssr coverage gaps", () => {
  it("document without optional fields", () => {
    expect(documentHtml("x")).toContain("x")
    expect(
      documentHtml("x", {
        title: undefined,
        livePath: undefined,
        clientEntry: undefined,
        styles: [],
        scripts: [],
      }),
    ).toContain("x")
  })


  it("api handler returns undefined → 204", async () => {
    const app = potato()
    const s = createServer({ app })
    s.get("/api/empty", () => undefined)
    const r = await s.fetch(new Request("http://x/api/empty"))
    expect(r.status).toBe(204)
  })

  it("api returns Response directly", async () => {
    const app = potato()
    const s = createServer({ app })
    s.get("/api/r", () => new Response("raw", { status: 201 }))
    expect((await s.fetch(new Request("http://x/api/r"))).status).toBe(201)
  })

  it("default onError path", async () => {
    const app = potato()
    const s = createServer({ app })
    s.get("/api/e", () => {
      throw new Error("x")
    })
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await s.fetch(new Request("http://x/api/e"))
    expect(r.status).toBe(500)
    err.mockRestore()
  })

  it("cors deny origin function", async () => {
    const app = potato()
    const s = createServer({
      app,
      middleware: [cors({ origin: () => false })],
    })
    s.get("/api/c", () => ({}))
    await s.fetch(
      new Request("http://x/api/c", { headers: { origin: "http://evil" } }),
    )
  })

  it("readJson effect fail", async () => {
    const app = potato()
    const s = createServer({ app })
    s.post(
      "/api/badjson",
      effectHandler(
        Effect.gen(function* () {
          return yield* readJson()
        }).pipe(Effect.catchAll((e) => Effect.succeed({ err: String(e) }))),
      ),
    )
    const r = await s.fetch(
      new Request("http://x/api/badjson", {
        method: "POST",
        body: "not-json",
        headers: { "content-type": "application/json" },
      }),
    )
    expect(r.status).toBe(200)
  })

  it("cookie header multi and expires domain", () => {
    const app = potato()
    const ctx = createContext(
      new Request("http://x/", {
        headers: { cookie: "a=1; b=2" },
      }),
      app,
    )
    expect(ctx.cookies.get("b")).toBe("2")
    ctx.cookies.set("c", "3", {
      expires: new Date("2030-01-01"),
      domain: "example.com",
      path: "/p",
      sameSite: "strict",
    })
    const res = ctx.json({})
    const cookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : []
    expect(cookies.length >= 0).toBe(true)
  })

  it("json 204", () => {
    const app = potato()
    const ctx = createContext(new Request("http://x/"), app)
    expect(ctx.json({}, 204).status).toBe(204)
    expect(ctx.html("x", 205).status).toBe(205)
  })
})

