import { test, expect } from "@playwright/test"
import { createServer as createHttp } from "node:http"
import { potato, defineStore, h } from "../packages/core/src/index.ts"
import { createServer } from "../packages/ssr/src/index.ts"

async function startDemo() {
  const app = potato()
  app.use(
    defineStore("count", { count: 0 }, ({ get, set, on, emit }) => {
      on("inc", () => {
        set({ count: get().count + 1 })
        emit("render")
      })
    }),
  )
  app.route("/", (state) =>
    h(
      "main",
      null,
      h("h1", null, "E2E Potato"),
      h("p", { "data-testid": "count" }, String((state as { count: number }).count)),
      h(
        "button",
        {
          type: "button",
          "data-testid": "inc",
          // SSR-only page: button is static; API increments below
        },
        "+1",
      ),
      h("a", { href: "/api/health", "data-testid": "health-link" }, "health"),
    ),
  )

  let count = 0
  const server = createServer({
    app,
    document: { title: "e2e" },
  })
  server.get("/api/health", () => ({ ok: true }))
  server.get("/api/count", () => ({ count }))
  server.post("/api/inc", () => {
    count++
    return { count }
  })

  const http = createHttp(async (req, res) => {
    const url = `http://127.0.0.1${req.url}`
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const body =
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : Buffer.concat(chunks)
    const request = new Request(url, {
      method: req.method,
      headers: req.headers as HeadersInit,
      body,
    })
    const response = await server.fetch(request)
    res.statusCode = response.status
    response.headers.forEach((v, k) => res.setHeader(k, v))
    res.end(Buffer.from(await response.arrayBuffer()))
  })

  await new Promise<void>((r) => http.listen(0, "127.0.0.1", () => r()))
  const addr = http.address()
  if (!addr || typeof addr === "string") throw new Error("no port")
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((r) => http.close(() => r())),
  }
}

test.describe("Potato SSR e2e", () => {
  test("renders SSR HTML and API", async ({ page, request }) => {
    const demo = await startDemo()
    try {
      const res = await request.get(`${demo.url}/api/health`)
      expect(await res.json()).toEqual({ ok: true })

      await page.goto(demo.url + "/")
      await expect(page.getByRole("heading", { name: "E2E Potato" })).toBeVisible()
      await expect(page.getByTestId("count")).toHaveText("0")

      const inc = await request.post(`${demo.url}/api/inc`)
      expect(await inc.json()).toEqual({ count: 1 })
    } finally {
      await demo.close()
    }
  })
})
