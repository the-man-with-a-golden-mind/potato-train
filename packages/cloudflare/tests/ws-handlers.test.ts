import { describe, expect, it, vi } from "vitest"
import { potato, h } from "potato-train-core"
import { createServer } from "potato-train-ssr"
import { potatoWorker } from "../src/index.js"

describe("websocket handlers fire", () => {
  it("message and close listeners", async () => {
    const listeners: Record<string, Function[]> = {}
    class FakePair {
      0 = {}
      1 = {
        accept: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: (ev: string, fn: Function) => {
          listeners[ev] ??= []
          listeners[ev]!.push(fn)
        },
      }
    }
    // @ts-expect-error mock
    globalThis.WebSocketPair = FakePair

    const app = potato()
    app.route("/", () => h("div", null, "x"))
    const server = createServer({ app })
    const worker = potatoWorker({
      server,
      live: { app, onEvent: () => {} },
    })
    await worker.fetch(
      new Request("http://x/__potato/live", {
        headers: { Upgrade: "websocket" },
      }),
      {},
      { waitUntil: () => {} },
    )
    // fire message with ArrayBuffer
    const buf = new TextEncoder().encode('{"type":"ping"}')
    for (const fn of listeners.message ?? []) {
      fn({ data: buf.buffer })
      fn({ data: '{"type":"ping"}' })
    }
    for (const fn of listeners.close ?? []) fn()
    // send/close error paths
    const pair = new FakePair()
    pair[1].send = () => {
      throw new Error("closed")
    }
    pair[1].close = () => {
      throw new Error("closed")
    }
  })
})
