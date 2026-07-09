/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest"
import { createApp, defineStore, h, asRawApp } from "../src/index.js"

describe("createApp", () => {
  type S = { n: number }
  type E = { add: [x: number] }

  it("typed app surface", () => {
    const app = createApp<S, E>({ state: { n: 0 } })
    app.use(
      defineStore<S, E>("s", { n: 0 }, ({ get, set, on, emit }) => {
        on("add", (x) => {
          set({ n: get().n + x })
          emit("render")
        })
      }),
    )
    app.route("/", (s, emit) =>
      h("button", { onclick: () => emit("add", 2) }, String(s.n)),
    )
    expect(app.toString("/")).toContain("0")
    app.emit("add", 3)
    expect(app.state.n).toBe(3)
    expect(asRawApp(app).state).toBe(app.raw.state)
    app.navigate("/z", { replace: true })
    expect(app.routes().length).toBe(1)
    expect(app.toVNode("/")).toBeTruthy()
    app.render()
  })

  it("use store after start", () => {
    document.body.innerHTML = '<div id="app"></div>'
    const app = createApp({ state: {} })
    app.route("/", () => h("div", null, "x"))
    app.mount("#app")
    app.use(() => {})
  })
})
