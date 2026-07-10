/**
 * SPA example — createApp + defineFeature + Tailwind CSS.
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
    on("counter:inc", (n) => {
      patch({ count: get().count + (n ?? 1) })
    })
    on("counter:reset", () => {
      patch({ count: 0 })
    })
  },
})

const app = createApp<State, Events>({
  debug: true,
  state: combineState(counter),
})

// Floating panel: Ctrl+Shift+P · window.__POTATO__
app.use(
  devtools({
    log: true,
    panel: true,
    quietFramework: true, // less noise; still in timeline
  }),
)
useFeatures(app, counter)

function Nav() {
  return (
    <nav class="mb-4 flex gap-4 text-sm font-medium">
      <a class="text-sky-600 hover:text-sky-800" href="/">
        Home
      </a>
      <a class="text-sky-600 hover:text-sky-800" href="/about">
        About
      </a>
    </nav>
  )
}

const card =
  "w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200"

app.route("/", (state, emit) => (
  <main class={card}>
    <Nav />
    <h1 class="mb-2 text-2xl font-bold tracking-tight">Potato SPA 🚂</h1>
    <p class="mb-6 text-slate-500">
      count is{" "}
      <span class="font-mono text-lg font-semibold text-slate-900">
        {state.count}
      </span>
    </p>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-lg bg-amber-400 px-4 py-2 font-bold text-slate-900 hover:bg-amber-300"
        onclick={() => emit("counter:inc", 1)}
      >
        +1
      </button>
      <button
        type="button"
        class="rounded-lg bg-slate-100 px-4 py-2 font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
        onclick={() => emit("counter:reset")}
      >
        reset
      </button>
    </div>
  </main>
))

app.route("/about", () => (
  <main class={card}>
    <Nav />
    <h1 class="mb-2 text-2xl font-bold">About</h1>
    <p class="text-slate-600 leading-relaxed">
      Typed <code class="rounded bg-slate-100 px-1 font-mono text-sm">createApp</code>{" "}
      +{" "}
      <code class="rounded bg-slate-100 px-1 font-mono text-sm">defineFeature</code>{" "}
      + Tailwind — bad emit names fail at compile time.
    </p>
  </main>
))

app.route("*", () => (
  <main class={card}>
    <h1 class="mb-2 text-2xl font-bold">404</h1>
    <a class="text-sky-600 hover:underline" href="/">
      Go home
    </a>
  </main>
))

app.mount("#app")
