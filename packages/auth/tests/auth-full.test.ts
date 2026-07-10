import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { potato, h } from "potato-train-core"
import { createServer } from "potato-train-ssr"
import {
  createAuth,
  memorySessionStore,
  hashPassword,
  verifyPassword,
  getAuth,
  requireUserEffect,
} from "../src/index.js"

describe("auth full", () => {
  it("memory store expiry and requireAuth", async () => {
    const store = memorySessionStore()
    await store.set({
      id: "old",
      userId: "u",
      expiresAt: Date.now() - 1000,
    })
    expect(await store.get("old")).toBeNull()
    await store.set({
      id: "ok",
      userId: "u1",
      expiresAt: Date.now() + 60_000,
    })
    expect((await store.get("ok"))?.userId).toBe("u1")
    await store.delete("ok")
    expect(await store.get("ok")).toBeNull()
  })

  it("login logout requireUser middleware", async () => {
    const auth = createAuth({
      secure: false,
      cookie: "sid",
      ttlSeconds: 60,
      getUser: async (id) =>
        id === "1" ? { id: "1", email: "a@b.c", roles: ["admin"] } : null,
    })
    const app = potato()
    app.route("/", () => h("div", null, "x"))
    const server = createServer({
      app,
      middleware: [auth.middleware],
    })
    // protect only secret — not login
    server.get("/api/secret", async (ctx) => {
      if (!ctx.locals.user) return ctx.json({ error: "Unauthorized" }, 401)
      return { user: getAuth(ctx).requireUser() }
    })
    server.post("/api/login", async (ctx) => {
      await getAuth(ctx).login("1", { ip: "1" })
      return { ok: true }
    })
    server.post("/api/logout", async (ctx) => {
      await getAuth(ctx).logout()
      return { ok: true }
    })

    const denied = await server.fetch(new Request("http://x/api/secret"))
    expect(denied.status).toBe(401)

    const login = await server.fetch(
      new Request("http://x/api/login", { method: "POST" }),
    )
    const cookies =
      typeof login.headers.getSetCookie === "function"
        ? login.headers.getSetCookie()
        : [login.headers.get("set-cookie")].filter(Boolean)
    expect(cookies.length).toBeGreaterThan(0)
    const cookiePair = String(cookies[0]).split(";")[0]!
    const ok = await server.fetch(
      new Request("http://x/api/secret", {
        headers: { cookie: cookiePair },
      }),
    )
    expect(ok.status).toBe(200)

    await server.fetch(
      new Request("http://x/api/logout", {
        method: "POST",
        headers: { cookie: cookiePair },
      }),
    )
  })

  it("requireUserEffect", async () => {
    const app = potato()
    const auth = createAuth({
      secure: false,
      getUser: async () => ({ id: "u" }),
    })
    const server = createServer({ app, middleware: [auth.middleware] })
    server.get("/api/me", async (ctx) => {
      const r = await Effect.runPromise(
        requireUserEffect(ctx).pipe(
          Effect.catchAll(() => Effect.succeed(null)),
        ),
      )
      return { user: r }
    })
    const res = await server.fetch(new Request("http://x/api/me"))
    expect(await res.json()).toEqual({ user: null })
  })

  it("hash edge cases", async () => {
    const h = await hashPassword("p", 10_000)
    expect(await verifyPassword("p", h)).toBe(true)
    expect(await verifyPassword("p", "bad")).toBe(false)
    // malformed pbkdf2 payload should not throw uncaught — return false
    expect(await verifyPassword("p", "pbkdf2$100$notbase64!!$also")).toBe(false)
  })
})
