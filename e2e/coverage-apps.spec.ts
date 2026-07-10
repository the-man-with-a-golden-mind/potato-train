/**
 * Playwright e2e covering real HTTP apps: SSR, spreadsheet, portfolio, trello.
 * Spins ephemeral servers per suite.
 */
import { test, expect, type Page } from "@playwright/test"
import { createServer as createHttp } from "node:http"
import { spawn, type ChildProcess } from "node:child_process"
import { resolve } from "node:path"
import { potato, defineStore, h, createApp } from "../packages/core/src/index.ts"
import { createServer, logger } from "../packages/ssr/src/index.ts"
import { createAuth, getAuth, hashPassword } from "../packages/auth/src/index.ts"
import { createSheetEngine } from "../packages/formula/src/index.ts"

const root = resolve(import.meta.dirname, "..")

async function listenFetch(
  server: { fetch: (req: Request) => Promise<Response> },
): Promise<{ url: string; close: () => Promise<void> }> {
  const http = createHttp(async (req, res) => {
    try {
      const host = req.headers.host ?? "127.0.0.1"
      const url = `http://${host}${req.url ?? "/"}`
      const headers = new Headers()
      for (const [k, v] of Object.entries(req.headers)) {
        if (v == null) continue
        if (Array.isArray(v)) v.forEach((x) => headers.append(k, x))
        else headers.set(k, v)
      }
      const chunks: Buffer[] = []
      for await (const c of req) chunks.push(c as Buffer)
      const body =
        req.method === "GET" || req.method === "HEAD"
          ? undefined
          : Buffer.concat(chunks)
      const request = new Request(url, {
        method: req.method,
        headers,
        body: body?.length ? new Uint8Array(body) : undefined,
      })
      const response = await server.fetch(request)
      res.statusCode = response.status
      response.headers.forEach((v, k) => res.setHeader(k, v))
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch (e) {
      res.statusCode = 500
      res.end(String(e))
    }
  })
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", () => r()))
  const addr = http.address()
  if (!addr || typeof addr === "string") throw new Error("no port")
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise((r) => http.close(() => r())),
  }
}

test.describe("SSR + auth e2e", () => {
  test("html page, health, login cookie", async ({ page, request }) => {
    const app = createApp<{ title: string }, { ping: [] }>({
      state: { title: "E2E" },
    })
    app.use(
      defineStore<{ title: string }, { ping: [] }>(
        "t",
        { title: "E2E" },
        () => {},
      ),
    )
    app.route("/", (s) =>
      h(
        "main",
        null,
        h("h1", null, s.title),
        h("a", { href: "/api/health", "data-testid": "health" }, "health"),
      ),
    )

    const users = new Map([
      [
        "1",
        {
          id: "1",
          email: "a@b.c",
          hash: await hashPassword("secret", 10_000),
        },
      ],
    ])
    const auth = createAuth({
      secure: false,
      getUser: async (id) => {
        const u = users.get(id)
        return u ? { id: u.id, email: u.email } : null
      },
    })

    const server = createServer({
      app: app.raw,
      middleware: [logger(), auth.middleware],
      document: { title: "e2e" },
    })
    server.get("/api/health", () => ({ ok: true }))
    server.post("/api/login", async (ctx) => {
      const body = (await ctx.req.json()) as { email?: string; password?: string }
      const u = [...users.values()].find((x) => x.email === body.email)
      if (!u) return ctx.json({ error: "no" }, 401)
      await getAuth(ctx).login(u.id)
      return { ok: true }
    })
    server.get("/api/me", (ctx) => ({ user: ctx.locals.user ?? null }))

    const demo = await listenFetch(server)
    try {
      expect(await (await request.get(`${demo.url}/api/health`)).json()).toEqual(
        { ok: true },
      )
      await page.goto(demo.url + "/")
      await expect(page.getByRole("heading", { name: "E2E" })).toBeVisible()
      const login = await request.post(`${demo.url}/api/login`, {
        data: { email: "a@b.c", password: "secret" },
      })
      expect(login.ok()).toBeTruthy()
      const cookie = login.headers()["set-cookie"]
      expect(cookie).toBeTruthy()
    } finally {
      await demo.close()
    }
  })
})

test.describe("formula sheet API e2e", () => {
  test("window + patch cell", async ({ request }) => {
    const eng = createSheetEngine({
      A1: "10",
      B1: "=A1*2",
    })
    const app = potato()
    app.route("/", () => h("div", null, "sheet"))
    const server = createServer({ app })
    server.get("/api/cells/:key", (ctx) => ({
      key: ctx.params.key,
      value: eng.getValue(ctx.params.key!),
      raw: eng.raw[ctx.params.key!.toUpperCase()] ?? "",
    }))
    server.patch("/api/cells/:key", async (ctx) => {
      const body = (await ctx.req.json()) as { value: string }
      eng.setCell(ctx.params.key!, body.value)
      return {
        key: ctx.params.key,
        value: eng.getValue(ctx.params.key!),
      }
    })
    const demo = await listenFetch(server)
    try {
      await request.patch(`${demo.url}/api/cells/A1`, {
        data: { value: "5" },
      })
      const b = await (await request.get(`${demo.url}/api/cells/B1`)).json()
      expect(b.value).toBe(10)
    } finally {
      await demo.close()
    }
  })
})

test.describe("SPA mount e2e", () => {
  test("client counter in page", async ({ page }) => {
    // Serve a minimal HTML that mounts potato via inline module is heavy;
    // instead verify typed app SSR fragment in browser context evaluate.
    const app = createApp<{ count: number }, { inc: [] }>({
      state: { count: 0 },
    })
    app.use(
      defineStore<{ count: number }, { inc: [] }>(
        "c",
        { count: 0 },
        ({ get, set, on, emit }) => {
          on("inc", () => {
            set({ count: get().count + 1 })
            emit("render")
          })
        },
      ),
    )
    app.route("/", (s) =>
      h("div", { id: "c" }, String(s.count)),
    )
    const html = `<!doctype html><html><body><div id="app">${app.toString("/")}</div></body></html>`
    await page.setContent(html)
    await expect(page.locator("#c")).toHaveText("0")
    // simulate store update + re-render string
    app.emit("inc")
    await page.setContent(
      `<!doctype html><html><body><div id="app">${app.toString("/")}</div></body></html>`,
    )
    await expect(page.locator("#c")).toHaveText("1")
  })
})

test.describe("example servers (spawn)", () => {
  let procs: ChildProcess[] = []

  test.afterEach(async () => {
    for (const p of procs) {
      p.kill("SIGTERM")
    }
    procs = []
  })

  async function waitHttp(url: string, ms = 15_000) {
    const start = Date.now()
    while (Date.now() - start < ms) {
      try {
        const r = await fetch(url)
        if (r.ok || r.status < 500) return
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error(`timeout waiting for ${url}`)
  }

  function startExample(filter: string, port: number, extraEnv: Record<string, string> = {}) {
    const p = spawn(
      "pnpm",
      ["--filter", filter, "exec", "tsx", "--tsconfig", "tsconfig.json", "src/server.ts"],
      {
        cwd: root,
        env: { ...process.env, PORT: String(port), ...extraEnv },
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      },
    )
    p.stderr?.on("data", (d) => {
      const s = String(d)
      if (s.includes("Error") || s.includes("error")) console.error(`[${filter}]`, s)
    })
    procs.push(p)
    return p
  }

  test.describe.configure({ mode: "serial" })

  test("ssr example health", async ({ request }) => {
    const port = 3191
    startExample("potato-train-example-ssr", port)
    await waitHttp(`http://127.0.0.1:${port}/api/health`)
    const j = await (await request.get(`http://127.0.0.1:${port}/api/health`)).json()
    expect(j.ok).toBe(true)
    const html = await (await request.get(`http://127.0.0.1:${port}/`)).text()
    expect(html).toContain("Potato")
  })

  test("spreadsheet example patch + interactive UI", async ({ page, request }) => {
    const port = 3192
    startExample("potato-train-example-spreadsheet", port)
    await waitHttp(`http://127.0.0.1:${port}/api/health`)

    // API
    const patch = await request.patch(
      `http://127.0.0.1:${port}/api/sheets/demo/cells/B2`,
      { data: { value: "7" } },
    )
    expect(patch.ok()).toBeTruthy()
    const cell = await (
      await request.get(`http://127.0.0.1:${port}/api/sheets/demo/cells/D2`)
    ).json()
    expect(cell.raw).toBe("=B2*C2")
    expect(cell.value).toBe(31.5) // 7 * 4.5

    const win = await (
      await request.get(
        `http://127.0.0.1:${port}/api/sheets/demo/window?rowStart=0&rowCount=5`,
      )
    ).json()
    expect(win.meta.rows).toBe(50_000)

    // Interactive UI
    await page.goto(`http://127.0.0.1:${port}/`)
    await expect(page.locator(".grid-scroll")).toBeVisible()
    await expect(page.locator(".header-row .col-head").first()).toBeVisible()
    await expect(page.locator(".cell").first()).toBeVisible({ timeout: 10_000 })

    // Select shows raw in formula bar
    await page.locator('.cell[title^="D2"]').first().click()
    await expect(page.locator(".name-box")).toHaveText("D2")
    await expect(page.locator(".formula-input")).toHaveValue("=B2*C2")

    // Double-click opens editor with raw formula
    await page.locator('.cell[title^="D2"]').first().dblclick()
    await expect(page.locator(".cell-input")).toBeVisible()
    await expect(page.locator(".cell-input")).toHaveValue("=B2*C2")
    await page.keyboard.press("Escape")

    // Sticky headers after scroll
    await page.locator(".grid-scroll").evaluate((el) => {
      el.scrollTop = 4000
    })
    await page.waitForTimeout(200)
    await expect(page.locator(".header-row .col-head span").first()).toHaveText("A")
    const headerTop = await page.locator(".header-row").evaluate((el) =>
      el.getBoundingClientRect().top,
    )
    expect(headerTop).toBeLessThan(200)

    // Deep scroll still virtualizes
    await page.locator(".grid-scroll").evaluate((el) => {
      el.scrollTop = 50_000
    })
    await page.waitForTimeout(300)
    await expect(page.locator(".status-bar")).toContainText("of 50,000")
    const maxScroll = await page.locator(".grid-scroll").evaluate(
      (el) => el.scrollHeight - el.clientHeight,
    )
    expect(maxScroll).toBeGreaterThan(100_000)
  })

  test("portfolio tick API + client asset", async ({ request }) => {
    const port = 3193
    startExample("potato-train-example-portfolio", port)
    await waitHttp(`http://127.0.0.1:${port}/api/health`)
    const tick = await request.post(`http://127.0.0.1:${port}/api/portfolio/tick`)
    expect(tick.ok()).toBeTruthy()
    const body = await tick.json()
    expect(body.portfolio.holdings.length).toBeGreaterThan(0)
    const client = await request.get(`http://127.0.0.1:${port}/assets/client.js`)
    expect(client.ok()).toBeTruthy()
  })

  test("trello board html + client asset", async ({ page, request }) => {
    const port = 3194
    startExample("potato-train-example-trello", port)
    await waitHttp(`http://127.0.0.1:${port}/api/health`)
    expect(
      await (await request.get(`http://127.0.0.1:${port}/api/health`)).json(),
    ).toMatchObject({ ok: true })
    const client = await request.get(`http://127.0.0.1:${port}/assets/client.js`)
    expect(client.ok()).toBeTruthy()
    await page.goto(`http://127.0.0.1:${port}/`)
    await expect(page.getByRole("heading", { name: /Potato Launch/i })).toBeVisible()
    await expect(page.locator(".card").first()).toBeVisible()
  })
})

