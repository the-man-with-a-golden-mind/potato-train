import { describe, expect, it } from "vitest"
import { potato, h } from "@potato/core"
import { createServer } from "@potato/ssr"
import {
  createAuth,
  hashPassword,
  verifyPassword,
  getAuth,
} from "../src/index.js"

describe("password hashing", () => {
  it("hash + verify", async () => {
    const hash = await hashPassword("secret")
    expect(hash.startsWith("pbkdf2$")).toBe(true)
    expect(await verifyPassword("secret", hash)).toBe(true)
    expect(await verifyPassword("wrong", hash)).toBe(false)
  })
})

describe("session auth", () => {
  it("login sets cookie and /me works", async () => {
    const users = new Map([["u1", { id: "u1", email: "a@b.c" }]])
    const auth = createAuth({
      secure: false,
      getUser: async (id) => users.get(id) ?? null,
    })
    const app = potato()
    app.route("/", () => h("div", null, "ok"))
    const server = createServer({ app, middleware: [auth.middleware] })
    server.post("/api/login", async (ctx) => {
      await getAuth(ctx).login("u1")
      return { ok: true }
    })
    server.get("/api/me", (ctx) => ({ user: ctx.locals.user }))

    const login = await server.fetch(
      new Request("http://x/api/login", { method: "POST" }),
    )
    const cookies =
      typeof login.headers.getSetCookie === "function"
        ? login.headers.getSetCookie()
        : [login.headers.get("set-cookie")].filter(Boolean)
    expect(cookies.length).toBeGreaterThan(0)
    const cookiePair = String(cookies[0]).split(";")[0]!

    const me = await server.fetch(
      new Request("http://x/api/me", {
        headers: { cookie: cookiePair },
      }),
    )
    expect(await me.json()).toEqual({
      user: { id: "u1", email: "a@b.c" },
    })
  })
})
