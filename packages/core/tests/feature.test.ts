/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest"
import {
  createApp,
  defineFeature,
  combineState,
  useFeatures,
  eventName,
  h,
  type InferFeatureState,
  type InferFeatureEvents,
  type CombineFeatureStates,
  type CombineFeatureEvents,
  type Expect,
  type Equal,
  type PrefixEvents,
} from "../src/index.js"

describe("defineFeature + types", () => {
  const counter = defineFeature<
    { count: number },
    { "counter:inc": [n?: number]; "counter:reset": [] }
  >({
    name: "counter",
    state: { count: 0 },
    setup: ({ get, patch, on }) => {
      on("counter:inc", (n) => {
        patch({ count: get().count + (n ?? 1) })
      })
      on("counter:reset", () => {
        patch({ count: 0 })
      })
    },
  })

  const todos = defineFeature<
    { items: string[] },
    { "todo:add": [title: string] }
  >({
    name: "todos",
    state: { items: [] as string[] },
    setup: ({ get, patch, on }) => {
      on("todo:add", (title) => {
        patch({ items: [...get().items, title] })
      })
    },
  })

  it("patch re-renders without manual emit", () => {
    type S = InferFeatureState<typeof counter>
    type E = InferFeatureEvents<typeof counter>
    const app = createApp<S, E>({ state: { ...counter.state } })
    app.useFeature(counter)
    app.route("/", (s, emit) =>
      h("button", { onclick: () => emit("counter:inc", 2) }, String(s.count)),
    )
    document.body.innerHTML = '<div id="app"></div>'
    app.mount("#app")
    expect(document.body.textContent).toContain("0")
    app.emit("counter:inc", 2)
    expect(app.state.count).toBe(2)
    expect(document.body.textContent).toContain("2")
  })

  it("combineState merges slices", () => {
    const state = combineState(counter, todos)
    expect(state).toEqual({ count: 0, items: [] })
  })

  it("useFeatures registers all stores", () => {
    type S = CombineFeatureStates<[typeof counter, typeof todos]>
    type E = CombineFeatureEvents<[typeof counter, typeof todos]>
    const app = createApp<S, E>({ state: combineState(counter, todos) })
    useFeatures(app, counter, todos)
    app.route("/", (s) => h("div", null, `${s.count}:${s.items.length}`))
    // Stores bind on first start/toString
    void app.toString("/")
    app.emit("counter:inc", 1)
    app.emit("todo:add", "x")
    expect(app.state.count).toBe(1)
    expect(app.state.items).toEqual(["x"])
  })

  it("eventName prefixes", () => {
    expect(eventName("sheet", "select")).toBe("sheet:select")
  })

  it("type-level PrefixEvents and Combine", () => {
    type P = PrefixEvents<"x", { a: [n: number] }>
    type _1 = Expect<Equal<P, { "x:a": [n: number] }>>
    type S = CombineFeatureStates<[typeof counter, typeof todos]>
    type _2 = Expect<Equal<S["count"], number>>
    type _3 = Expect<Equal<S["items"], string[]>>
    void 0 as unknown as _1
    void 0 as unknown as _2
    void 0 as unknown as _3
  })
})
