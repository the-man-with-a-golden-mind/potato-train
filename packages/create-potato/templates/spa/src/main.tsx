/**
 * Potato SPA — product architecture:
 * createApp + State + Events + defineFeature + Tailwind
 */
import "./styles.css"
import {
  createApp,
  defineFeature,
  combineState,
  useFeatures,
} from "potato-train-core"
import { devtools } from "potato-train-debug"

type State = { count: number }
type Events = {
  "counter:inc": [n?: number]
  "counter:reset": []
}

const counter = defineFeature<State, Events>({
  name: "counter",
  state: { count: 0 },
  setup: ({ get, patch, on }) => {
    on("counter:inc", (n) => patch({ count: get().count + (n ?? 1) }))
    on("counter:reset", () => patch({ count: 0 }))
    // on("counter:icn", …) // ❌ compile error — types, not grep
  },
})

const app = createApp<State, Events>({
  debug: true,
  state: combineState(counter),
})

app.use(devtools())
useFeatures(app, counter)

app.route("/", (state, emit) => (
  <main class="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
    <h1 class="mb-2 text-2xl font-bold tracking-tight">Potato 🚂</h1>
    <p class="mb-6 text-slate-500">
      count is{" "}
      <span class="font-mono text-lg font-semibold text-slate-900">
        {state.count}
      </span>
    </p>
    <div class="flex gap-2">
      <button
        type="button"
        class="rounded-lg bg-amber-400 px-4 py-2 font-bold text-slate-900 hover:bg-amber-300"
        onclick={() => emit("counter:inc", 1)}
      >
        +1
      </button>
      <button
        type="button"
        class="rounded-lg bg-slate-100 px-4 py-2 font-semibold ring-1 ring-slate-200 hover:bg-slate-200"
        onclick={() => emit("counter:reset")}
      >
        reset
      </button>
    </div>
    <p class="mt-4 text-sm text-slate-400">
      Tailwind + typed Events — bad emit names fail at compile time.
    </p>
  </main>
))

app.mount("#app")
