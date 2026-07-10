/**
 * SSR scaffold — createApp + defineFeature + liveClick (needs Live client).
 */
import {
  createApp,
  defineFeature,
  combineState,
  asRawApp,
  type PotatoApp,
} from "potato-train-core"
import { liveClick } from "potato-train-live"

type State = { count: number }
type Events = { "counter:inc": [n?: number]; "counter:reset": [] }

const counter = defineFeature<State, Events>({
  name: "counter",
  state: { count: 0 },
  setup: ({ get, patch, on }) => {
    on("counter:inc", (n) => patch({ count: get().count + (n ?? 1) }))
    on("counter:reset", () => patch({ count: 0 }))
  },
})

export function createAppRaw(): PotatoApp {
  const app = createApp<State, Events>({ state: combineState(counter) })
  app.useFeature(counter)

  app.route("/", (state) => (
    <main class="mx-auto max-w-md px-4 py-12 font-sans text-slate-100">
      <h1 class="mb-2 text-3xl font-bold text-white">Potato SSR 🚂</h1>
      <p class="mb-6 text-slate-400">
        count ={" "}
        <span class="font-mono text-xl font-semibold text-white">
          {state.count}
        </span>
      </p>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950 hover:bg-sky-400"
          {...liveClick("counter:inc", 1)}
        >
          +1
        </button>
        <button
          type="button"
          class="rounded-lg bg-slate-800 px-4 py-2 font-semibold ring-1 ring-slate-700 hover:bg-slate-700"
          {...liveClick("counter:reset")}
        >
          reset
        </button>
      </div>
      <p class="mt-6 text-xs text-slate-500">
        Live WebSocket client boots automatically — click works after join.
      </p>
    </main>
  ))

  return asRawApp(app)
}
