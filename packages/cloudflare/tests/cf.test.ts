import { describe, expect, it, vi, beforeEach } from "vitest"
import { potato, h } from "@potato/core"
import { createServer } from "@potato/ssr"
import { potatoWorker, serveAssets } from "../src/index.js"

describe("serveAssets", () => {
  it("serves static paths", async () => {
    const assets = {
      fetch: vi.fn(async () => new Response("css", { status: 200 })),
    }
    const res = await serveAssets(
      new Request("http://x/assets/a.css"),
      assets,
    )
    expect(res?.status).toBe(200)
    const miss = await serveAssets(
      new Request("http://x/page"),
      assets,
    )
    expect(miss).toBeNull()
    assets.fetch.mockResolvedValueOnce(new Response("no", { status: 404 }))
    const n = await serveAssets(new Request("http://x/x.js"), assets)
    expect(n).toBeNull()
  })
})

describe("potatoWorker", () => {
  beforeEach(() => {
    class FakePair {
      0 = {
        /* client */
      }
      1 = {
        accept: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
      }
    }
    // @ts-expect-error mock CF
    globalThis.WebSocketPair = FakePair
  })

  it("delegates fetch to server", async () => {
    const app = potato()
    app.route("/", () => h("div", null, "ok"))
    const server = createServer({ app })
    server.get("/api/h", () => ({ ok: true }))
    const worker = potatoWorker({ server })
    const res = await worker.fetch(
      new Request("http://x/api/h"),
      {},
      { waitUntil: () => {} },
    )
    expect(await res.json()).toEqual({ ok: true })
  })

  it("handles websocket upgrade when live configured", async () => {
    const app = potato()
    app.route("/", () => h("div", null, "l"))
    const server = createServer({ app })
    const worker = potatoWorker({
      server,
      live: { app, path: "/__potato/live" },
    })
    // Ensure Upgrade header is visible (some fetch impls are picky)
    const headers = new Headers()
    headers.set("Upgrade", "websocket")
    headers.set("upgrade", "websocket")
    const res = await worker.fetch(
      new Request("http://x/__potato/live", { headers }),
      {},
      { waitUntil: () => {} },
    )
    // Workers: 101; Node undici: 426 fallback after exercising upgrade path
    expect([101, 426]).toContain(res.status)
  })
})

