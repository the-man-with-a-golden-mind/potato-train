/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest"
import { potato, h, defineStore } from "@potato/core"
import {
  devtools,
  attachDebug,
  diffState,
  snapshotState,
  formatDiff,
  classifyEvent,
} from "../src/index.js"

describe("diff helpers", () => {
  it("diffs added/changed/removed keys", () => {
    const d = diffState({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 })
    expect(d.some((x) => x.path === "b" && x.kind === "change")).toBe(true)
    expect(d.some((x) => x.path === "c" && x.kind === "add")).toBe(true)
    expect(formatDiff(d)).toContain("b")
  })

  it("snapshot skips functions and cache", () => {
    const s = snapshotState({
      n: 1,
      cache: {},
      fn: () => 1,
    } as Record<string, unknown>)
    expect(s.n).toBe(1)
    expect(s.cache).toBeUndefined()
    expect(s.fn).toBeUndefined()
  })

  it("classifyEvent", () => {
    expect(classifyEvent("render")).toBe("render")
    expect(classifyEvent("navigate")).toBe("navigate")
    expect(classifyEvent("todo:add")).toBe("event")
  })
})

describe("devtools", () => {
  it("logs events, diffs state, exposes inspector", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const app = potato()
    app.use(
      devtools({
        history: 10,
        panel: false,
        filter: (e) => e !== "skip",
      }),
    )
    app.use(
      defineStore("n", { n: 0 }, ({ set, on, emit, get }) => {
        on("inc", () => {
          set({ n: get().n + 1 })
          emit("render")
        })
      }),
    )
    app.route("/", (s) => h("div", null, String((s as { n: number }).n)))
    document.body.innerHTML = '<div id="app"></div>'
    app.mount("#app")
    app.emitter.emit("inc")
    app.emitter.emit("skip")
    app.emitter.emit("inc")

    const insp = (
      window as unknown as {
        __POTATO__: {
          history: Array<{ event: string; diffs: unknown[] }>
          clear: () => void
          emit: (e: string) => void
          state: { n: number }
          stats: { events: number; renders: number }
          subscribe: (fn: (r: unknown) => void) => () => void
        }
      }
    ).__POTATO__

    expect(insp.history.length).toBeGreaterThan(0)
    expect(insp.state.n).toBe(2)
    expect(insp.stats.events).toBeGreaterThan(0)
    const inc = insp.history.find((h) => h.event === "inc")
    expect(inc?.diffs?.length).toBeGreaterThan(0)

    let subHits = 0
    const unsub = insp.subscribe(() => {
      subHits++
    })
    insp.emit("inc")
    expect(subHits).toBeGreaterThan(0)
    unsub()

    insp.clear()
    expect(insp.history.length).toBe(0)

    log.mockRestore()
    info.mockRestore()
  })

  it("attachDebug", () => {
    const app = potato()
    app.route("/", () => h("div", null, "x"))
    attachDebug(app, { log: false, expose: false, panel: false })
    app.emitter.emit("x")
  })

  it("render timing log path", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    document.body.innerHTML = '<div id="app"></div>'
    const app = potato()
    app.use(devtools({ expose: false, panel: false }))
    app.route("/", () => h("div", null, "x"))
    app.mount("#app")
    app.render()
    app.render()
    log.mockRestore()
  })

  it("creates panel UI when panel true", () => {
    document.body.innerHTML = '<div id="app"></div>'
    const app = potato()
    app.use(devtools({ log: false, panel: true, expose: true }))
    app.route("/", () => h("div", null, "x"))
    app.mount("#app")
    app.emitter.emit("hello", 1)
    expect(document.getElementById("potato-debug-root")).toBeTruthy()
    const insp = (
      window as unknown as {
        __POTATO__: { open: () => void; toggle: () => void; close: () => void }
      }
    ).__POTATO__
    insp.open()
    expect(document.getElementById("potato-debug-root")?.classList.contains("open")).toBe(
      true,
    )
    insp.close()
  })
})
