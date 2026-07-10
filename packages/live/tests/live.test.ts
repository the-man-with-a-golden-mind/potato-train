/** @vitest-environment happy-dom */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { potato, h, defineStore } from "potato-train-core"
import {
  createLiveHub,
  encode,
  decode,
  liveClick,
  liveSubmit,
  liveChange,
  connectLive,
} from "../src/index.js"

describe("protocol", () => {
  it("encode/decode", () => {
    const msg = { type: "ping" as const }
    expect(decode(encode(msg))).toEqual(msg)
  })
})

describe("live helpers", () => {
  it("attrs", () => {
    expect(liveClick("x", { a: 1 })["data-potato-click"]).toBe("x")
    expect(liveClick("x", "s")["data-potato-value"]).toBe("s")
    expect(liveSubmit("f")["data-potato-submit"]).toBe("f")
    expect(liveChange("c")["data-potato-change"]).toBe("c")
  })
})

describe("createLiveHub multiplayer", () => {
  it("join event leave broadcast", async () => {
    const app = potato()
    app.use(defineStore("c", { n: 0 }, ({ set, on, emit, get }) => {
      on("inc", () => {
        set({ n: get().n + 1 })
        emit("render")
      })
    }))
    app.route("/", (s) =>
      h("div", null, String((s as { n: number }).n)),
    )

    const sent1: string[] = []
    const sent2: string[] = []
    const sock1 = {
      send: (d: string) => sent1.push(d),
      close: () => {},
    }
    const sock2 = {
      send: (d: string) => sent2.push(d),
      close: () => {},
    }

    const hub = createLiveHub({
      app,
      broadcast: true,
      sharedState: () => ({ n: 0 }),
      onEvent: (event, _p, session) => {
        if (event === "inc") {
          const n = Number((session.state as { n?: number }).n ?? 0) + 1
          ;(session.state as { n: number }).n = n
        }
      },
    })

    await hub.handleMessage(
      sock1,
      encode({ type: "join", topic: "t", href: "/" }),
    )
    expect(sent1.some((s) => s.includes('"type":"ok"'))).toBe(true)

    await hub.handleMessage(sock1, encode({ type: "ping" }))
    expect(sent1.some((s) => s.includes("pong"))).toBe(true)

    await hub.handleMessage(
      sock2,
      encode({ type: "join", topic: "t", href: "/" }),
    )

    await hub.handleMessage(
      sock1,
      encode({ type: "event", topic: "t", event: "inc", payload: {} }),
    )
    expect(sent1.some((s) => s.includes("patch"))).toBe(true)
    expect(sent2.some((s) => s.includes("patch"))).toBe(true)

    await hub.handleMessage(
      sock1,
      encode({ type: "leave", topic: "t" }),
    )
    hub.disconnect(sock2)

    await hub.handleRaw(sock1, encode({ type: "ping" }))
    // invalid json
    await hub.handleMessage(sock1, "not-json")
    // no session event
    const sock3 = { send: vi.fn(), close: () => {} }
    await hub.handleMessage(
      sock3,
      encode({ type: "event", topic: "t", event: "x" }),
    )
    expect(sock3.send).toHaveBeenCalled()

    hub.broadcast("t", (s) => {
      ;(s.state as { n: number }).n = 99
    })
  })

  it("onEvent mutates session.state only (no app.emitter)", async () => {
    const app = potato()
    app.route("/", (s) => h("i", null, String((s as { n: number }).n ?? 0)))
    const hub = createLiveHub({
      app,
      broadcast: false,
      sharedState: () => ({ n: 0 }),
      onEvent: (event, _p, session) => {
        if (event === "bump") {
          ;(session.state as { n: number }).n =
            Number((session.state as { n?: number }).n ?? 0) + 1
        }
      },
    })
    const sock = { send: vi.fn(), close: () => {} }
    await hub.handleMessage(
      sock,
      encode({ type: "join", topic: "p", href: "/" }),
    )
    await hub.handleMessage(
      sock,
      encode({ type: "event", topic: "p", event: "bump" }),
    )
    expect(sock.send).toHaveBeenCalled()
    expect((app.state as { n?: number }).n).toBeUndefined()
  })

  it("requires onEvent", () => {
    const app = potato()
    expect(() =>
      // @ts-expect-error onEvent required
      createLiveHub({ app }),
    ).toThrow(/onEvent/)
  })
})

describe("connectLive client", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"><button data-potato-click="x">c</button></div>'
  })

  it("connects and morphs on message", async () => {
    const instances: FakeWS[] = []
    class FakeWS {
      static OPEN = 1
      readyState = 1
      onopen: (() => void) | null = null
      onmessage: ((ev: { data: string }) => void) | null = null
      onclose: (() => void) | null = null
      onerror: (() => void) | null = null
      sent: string[] = []
      constructor(public url: string) {
        instances.push(this)
        queueMicrotask(() => this.onopen?.())
      }
      send(d: string) {
        this.sent.push(d)
      }
      close() {
        this.readyState = 3
        this.onclose?.()
      }
    }
    // @ts-expect-error mock
    globalThis.WebSocket = FakeWS

    const live = connectLive({
      url: "ws://localhost/live",
      topic: "page",
      debug: true,
      onState: vi.fn(),
    })

    await Promise.resolve()
    expect(instances[0]!.sent.some((s) => s.includes("join"))).toBe(true)

    instances[0]!.onmessage?.({
      data: encode({
        type: "ok",
        topic: "page",
        html: "<p>hello-live</p>",
        state: { a: 1 },
      }),
    })
    expect(document.getElementById("app")!.textContent).toContain("hello-live")

    // click delegation
    document.body.innerHTML =
      '<div id="app"><button data-potato-click="go" data-potato-value=\'{"n":1}\'>c</button></div>'
    // re-get — connectLive bound old root; create new connection
    live.disconnect()
    const live2 = connectLive({ url: "ws://x", root: "#app" })
    await Promise.resolve()
    const ws = instances[instances.length - 1]!
    document.querySelector("button")!.click()
    expect(ws.sent.some((s) => s.includes("go"))).toBe(true)

    // form submit
    document.getElementById("app")!.innerHTML =
      '<form data-potato-submit="save"><input name="t" value="v"/></form>'
    document.querySelector("form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    )

    // change
    document.getElementById("app")!.innerHTML =
      '<input data-potato-change="ch" value="z"/>'
    document.querySelector("input")!.dispatchEvent(
      new Event("change", { bubbles: true }),
    )

    instances[instances.length - 1]!.onmessage?.({
      data: encode({ type: "redirect", href: "/x" }),
    })
    instances[instances.length - 1]!.onmessage?.({
      data: encode({ type: "error", message: "e" }),
    })

    live2.sendEvent("manual", 1)
    live2.disconnect()
  })
})
