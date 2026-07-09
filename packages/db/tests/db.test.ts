import { describe, expect, it, vi } from "vitest"
import { potato } from "@potato/core"
import { createServer } from "@potato/ssr"
import {
  dbMiddleware,
  getDb,
  eq,
  and,
  sql,
} from "../src/index.js"
import { createD1, d1Middleware, d1FromEnv } from "../src/d1.js"

describe("db middleware", () => {
  it("attaches db to locals", async () => {
    const app = potato()
    const server = createServer({
      app,
      middleware: [dbMiddleware({ query: "ok" })],
    })
    server.get("/api/db", (ctx) => {
      return { db: getDb<{ query: string }>(ctx).query }
    })
    const res = await server.fetch(new Request("http://x/api/db"))
    expect(await res.json()).toEqual({ db: "ok" })
  })

  it("factory db and getDb throws", async () => {
    const app = potato()
    const server = createServer({
      app,
      middleware: [dbMiddleware(async () => ({ id: 1 }))],
    })
    server.get("/api/x", (ctx) => getDb(ctx))
    expect((await (await server.fetch(new Request("http://x/api/x"))).json())).toEqual({
      id: 1,
    })
    const bare = createServer({ app: potato() })
    bare.get("/api/y", (ctx) => {
      try {
        getDb(ctx)
        return {}
      } catch (e) {
        return { err: e instanceof Error ? e.message : "e" }
      }
    })
    const r = await bare.fetch(new Request("http://x/api/y"))
    expect((await r.json() as { err: string }).err).toContain("no db")
  })

  it("re-exports drizzle helpers", () => {
    expect(typeof eq).toBe("function")
    expect(typeof and).toBe("function")
    expect(sql).toBeDefined()
  })
})

describe("d1 helpers", () => {
  it("createD1 and middleware", async () => {
    const fakeD1 = {
      prepare: vi.fn(),
      dump: vi.fn(),
      batch: vi.fn(),
      exec: vi.fn(),
    }
    const db = createD1(fakeD1)
    expect(db).toBeTruthy()

    const app = potato()
    const server = createServer({
      app,
      middleware: [d1Middleware("DB")],
      env: { DB: fakeD1 },
    })
    server.get("/api/d1", (ctx) => ({ has: Boolean(ctx.locals.db) }))
    const res = await server.fetch(new Request("http://x/api/d1"), {
      DB: fakeD1,
    })
    // env merge — createServer uses envOverride
    expect(res.status).toBeLessThan(500)

    expect(() => d1FromEnv({}, "DB")).toThrow(/missing/)
    expect(d1FromEnv({ DB: fakeD1 }, "DB")).toBeTruthy()
  })

  it("d1Middleware throws without binding", async () => {
    const app = potato()
    const server = createServer({
      app,
      middleware: [d1Middleware("DB")],
      onError: (e, ctx) =>
        ctx.json({ err: e instanceof Error ? e.message : "e" }, 500),
    })
    server.get("/api/z", () => ({}))
    const res = await server.fetch(new Request("http://x/api/z"))
    expect(res.status).toBe(500)
  })
})
