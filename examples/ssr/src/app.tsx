/**
 * SSR + Live todos — createApp + typed Events + Tailwind.
 */
import {
  createApp as createTypedApp,
  defineFeature,
  combineState,
  asRawApp,
  type TypedPotatoApp,
  type PotatoApp,
} from "potato-train-core"
import { liveClick } from "potato-train-live"

export type Todo = { id: number; text: string; done: boolean }

export type State = {
  todos: Todo[]
  draft: string
}

export type Events = {
  "todo:toggle": [id: number]
  "todo:add": [text?: string]
  "todo:draft": [value: string]
}

const todos = defineFeature<State, Events>({
  name: "todos",
  state: {
    todos: [
      { id: 1, text: "Ship Potato SSR", done: false },
      { id: 2, text: "Add LiveView patches", done: true },
    ],
    draft: "",
  },
  setup: ({ get, patch, on }) => {
    on("todo:toggle", (id) => {
      patch({
        todos: get().todos.map((t) =>
          t.id === Number(id) ? { ...t, done: !t.done } : t,
        ),
      })
    })
    on("todo:add", (text) => {
      const value = String(text ?? get().draft).trim()
      if (!value) return
      patch({
        todos: [
          ...get().todos,
          { id: Date.now(), text: value, done: false },
        ],
        draft: "",
      })
    })
    on("todo:draft", (value) => {
      patch({ draft: String(value ?? "") })
    })
  },
})

export function createTodoApp(): TypedPotatoApp<State, Events> {
  const app = createTypedApp<State, Events>({ state: combineState(todos) })
  app.useFeature(todos)

  app.route("/", (state) => (
    <main class="mx-auto max-w-lg px-4 py-10 font-sans text-slate-100">
      <h1 class="mb-2 text-3xl font-bold tracking-tight text-white">
        Potato SSR + Live 🚂
      </h1>
      <p class="mb-6 text-slate-400">
        Server-driven UI (Phoenix LiveView style). Clicks go to the server.
        Styled with Tailwind.
      </p>
      <ul class="mb-6 space-y-2">
        {state.todos.map((t) => (
          <li
            key={t.id}
            class="flex items-center gap-3 rounded-xl bg-slate-800/80 px-3 py-2 ring-1 ring-slate-700"
          >
            <button
              type="button"
              class="rounded-md bg-slate-700 px-2 py-1 text-sm hover:bg-slate-600"
              {...liveClick("todo:toggle", t.id)}
            >
              {t.done ? "✅" : "⬜"}
            </button>
            <span class={t.done ? "text-slate-500 line-through" : ""}>
              {t.text}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        class="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950 hover:bg-sky-400"
        {...liveClick("todo:add", "New live todo")}
      >
        Add todo (live)
      </button>
    </main>
  ))

  return app
}

export function createApp(): PotatoApp {
  return asRawApp(createTodoApp())
}
