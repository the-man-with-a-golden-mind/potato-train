/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest"
import { potato, h, defineStore } from "@potato/core"
import { devtools, attachDebug } from "../src/index.js"

describe("devtools", () => {
  it("logs events and exposes inspector", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const app = potato()
    app.use(
      devtools({
        history: 2,
        filter: (e) => e !== "skip",
      }),
    )
    app.use(defineStore("n", { n: 0 }, ({ set, on, emit, get }) => {
      on("inc", () => {
        set({ n: get().n + 1 })
        emit("render")
      })
    }))
    app.route("/", (s) => h("div", null, String((s as { n: number }).n)))
    document.body.innerHTML = '<div id="app"></div>'
    app.mount("#app")
    app.emitter.emit("inc")
    app.emitter.emit("skip")
    app.emitter.emit("inc")
    const insp = (window as unknown as { __POTATO__: { history: unknown[]; clear: () => void; emit: Function; state: unknown } }).__POTATO__
    expect(insp.history.length).toBeGreaterThan(0)
    insp.clear()
    expect(insp.history.length).toBe(0)
    insp.emit("inc")
    log.mockRestore()
    info.mockRestore()
  })

  it("attachDebug", () => {
    const app = potato()
    app.route("/", () => h("div", null, "x"))
    attachDebug(app, { log: false, expose: false })
    app.emitter.emit("x")
  })

  it("render timing log path", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    document.body.innerHTML = '<div id="app"></div>'
    const app = potato()
    app.use(devtools({ expose: false }))
    app.route("/", () => h("div", null, "x"))
    app.mount("#app")
    app.render()
    app.render()
    log.mockRestore()
  })
})
