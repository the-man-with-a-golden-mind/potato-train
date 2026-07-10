/**
 * Interactive e2e for Node examples (spawn servers, click real UI).
 */
import { test, expect } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

test.describe("interactive examples", () => {
  let procs: ChildProcess[] = []

  test.afterEach(async () => {
    for (const p of procs) p.kill("SIGTERM")
    procs = []
  })

  async function waitHttp(url: string, ms = 20_000) {
    const start = Date.now()
    while (Date.now() - start < ms) {
      try {
        const r = await fetch(url)
        if (r.ok || r.status < 500) return
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 250))
    }
    throw new Error(`timeout waiting for ${url}`)
  }

  function startExample(filter: string, port: number) {
    const p = spawn(
      "pnpm",
      ["--filter", filter, "exec", "tsx", "--tsconfig", "tsconfig.json", "src/server.ts"],
      {
        cwd: root,
        env: { ...process.env, PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    p.stderr?.on("data", (d) => {
      const s = String(d)
      if (/Error|error|ERR_/.test(s)) console.error(`[${filter}]`, s)
    })
    procs.push(p)
    return p
  }

  test.describe.configure({ mode: "serial" })

  test("ssr live: add todo", async ({ page }) => {
    const port = 3201
    startExample("potato-train-example-ssr", port)
    await waitHttp(`http://127.0.0.1:${port}/api/health`)
    await waitHttp(`http://127.0.0.1:${port}/assets/client.js`)
    await page.goto(`http://127.0.0.1:${port}/`)
    await page.waitForTimeout(800)
    const before = await page.locator("li").count()
    await page.getByRole("button", { name: /Add todo/i }).click()
    await expect.poll(async () => page.locator("li").count()).toBeGreaterThan(before)
  })

  test("portfolio: simulate tick updates UI", async ({ page }) => {
    const port = 3202
    startExample("potato-train-example-portfolio", port)
    await waitHttp(`http://127.0.0.1:${port}/api/health`)
    await waitHttp(`http://127.0.0.1:${port}/assets/client.js`)
    await page.goto(`http://127.0.0.1:${port}/`)
    await expect(page.getByRole("heading", { name: /Growth Book/i })).toBeVisible()
    await page.getByRole("button", { name: "Simulate tick" }).click()
    await expect(page.locator("header p")).toContainText(/Tick applied|Updated|Loaded/i, {
      timeout: 8_000,
    })
  })

  test("trello: add card via Live", async ({ page }) => {
    const port = 3203
    startExample("potato-train-example-trello", port)
    await waitHttp(`http://127.0.0.1:${port}/api/health`)
    await waitHttp(`http://127.0.0.1:${port}/assets/client.js`)
    await page.goto(`http://127.0.0.1:${port}/`)
    await page.waitForTimeout(1000)
    const title = `E2E-${Date.now()}`
    await page.locator('input[name="title"]').first().fill(title)
    await page.locator('button[type="submit"]').first().click()
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 })
  })
})
