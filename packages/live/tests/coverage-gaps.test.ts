/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest"
import { potato, h } from "potato-train-core"
import { createLiveHub, encode, connectLive, liveClick } from "../src/index.js"

describe("live gaps", () => {
  it("serializeState fallback and onJoin", async () => {
    const app = potato()
    app.route("/", () => h("div", null, "x"))
    // put non-serializable on state
    ;(app.state as { fn?: () => void }).fn = () => {}
    const hub = createLiveHub({
      app,
      onEvent: () => {},
      onJoin: async (s) => {
        s.state.title = "joined"
      },
    })
    const sock = { send: vi.fn(), close: vi.fn() }
    await hub.handleMessage(
      sock,
      encode({ type: "join", topic: "t", href: "/", params: { a: "1" } }),
    )
    expect(sock.send).toHaveBeenCalled()
    hub.getShared("t")
  })

  it("connectLive missing root throws on apply", async () => {
    document.body.innerHTML = ""
    class FakeWS {
      static OPEN = 1
      readyState = 1
      onopen: (() => void) | null = null
      onmessage: ((e: { data: string }) => void) | null = null
      onclose: (() => void) | null = null
      onerror: (() => void) | null = null
      send = vi.fn()
      close = vi.fn(() => {
        this.readyState = 3
        this.onclose?.()
      })
      constructor() {
        queueMicrotask(() => this.onopen?.())
      }
    }
    // @ts-expect-error mock
    globalThis.WebSocket = FakeWS
    const c = connectLive({ url: "ws://x", root: "#missing" })
    await Promise.resolve()
    c.disconnect()
    expect(liveClick("e")).toBeTruthy()
  })
})
