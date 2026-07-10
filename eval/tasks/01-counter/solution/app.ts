import { createApp, defineStore, h } from "potato-train-core"

export type State = { count: number }
export type Events = {
  increment: [n?: number]
  reset: []
}

export function createCounterApp() {
  const app = createApp<State, Events>({ state: { count: 0 } })

  app.use(
    defineStore<State, Events>("count", { count: 0 }, ({ get, set, on, emit }) => {
      on("increment", (...args) => {
        const n = args[0]
        set({ count: get().count + (n ?? 1) })
        emit("render")
      })
      on("reset", () => {
        set({ count: 0 })
        emit("render")
      })
    }),
  )

  app.route("/", (state, emit) =>
    h(
      "main",
      null,
      h("p", { "data-count": "" }, String(state.count)),
      h("button", { type: "button", onclick: () => emit("increment", 1) }, "+1"),
      h("button", { type: "button", onclick: () => emit("reset") }, "reset"),
    ),
  )

  return app
}
