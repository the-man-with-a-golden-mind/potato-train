import { describe, expect, it } from "vitest"
import { potato, defineStore, h } from "../src/index.js"

describe("defineStore typed initial state", () => {
  it("seeds state and types get/set without casts", () => {
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
      h("span", null, String((state as { count: number }).count)),
    )
    expect(app.toString("/")).toBe("<span>0</span>")
    app.emitter.emit("inc")
    // stores already ran; state mutated
    expect((app.state as { count: number }).count).toBe(1)
  })

  it("update() mutates draft", () => {
    const app = potato()
    app.use(
      defineStore("bag", { items: [] as string[] }, ({ update, on, emit }) => {
        on("add", (x) => {
          update((s) => {
            s.items.push(String(x))
          })
          emit("render")
        })
      }),
    )
    app.route("/", () => h("div", null, "x"))
    app.toString("/") // run stores
    app.emitter.emit("add", "a")
    expect((app.state as { items: string[] }).items).toEqual(["a"])
  })

  it("patch() sets state and emits render", () => {
    const app = potato()
    let renders = 0
    app.emitter.on("render", () => {
      renders++
    })
    app.use(
      defineStore("n", { n: 0 }, ({ get, patch, on }) => {
        on("bump", () => {
          patch({ n: get().n + 1 })
        })
      }),
    )
    app.route("/", (s) => h("span", null, String((s as { n: number }).n)))
    app.toString("/")
    const before = renders
    app.emitter.emit("bump")
    expect((app.state as { n: number }).n).toBe(1)
    expect(renders).toBeGreaterThan(before)
  })
})
