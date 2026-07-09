/**
 * Cloudflare Workers — createApp + Live (+1) with client boot script.
 */
import {
  createApp,
  defineFeature,
  combineState,
  asRawApp,
} from "@potato/core"
import { createServer, logger } from "@potato/ssr"
import { potatoWorker } from "@potato/cloudflare"
import { liveClick } from "@potato/live"
import { liveBootScript } from "../../_shared/live-boot.js"
import tw from "./tw-inline.js"

type State = { count: number }
type Events = { inc: [] }

const counter = defineFeature<State, Events>({
  name: "counter",
  state: { count: 0 },
  setup: ({ get, patch, on }) => {
    on("inc", () => {
      patch({ count: get().count + 1 })
    })
  },
})

function createCounterApp() {
  const app = createApp<State, Events>({ state: combineState(counter) })
  app.useFeature(counter)
  app.route("/", (state) => (
    <main class="mx-auto max-w-md p-8 font-sans text-slate-900">
      <h1 class="mb-2 text-3xl font-bold tracking-tight">
        Potato on Cloudflare 🚂
      </h1>
      <p class="mb-6 text-slate-600">
        count:{" "}
        <span class="font-mono text-xl font-semibold">{state.count}</span>
      </p>
      <button
        type="button"
        class="rounded-lg bg-amber-400 px-4 py-2 font-bold text-slate-900 hover:bg-amber-300"
        {...liveClick("inc")}
      >
        +1 (live)
      </button>
      <p class="mt-4 text-xs text-slate-400">
        Tailwind + Workers + Live WebSocket
      </p>
    </main>
  ))
  return app
}

const typed = createCounterApp()
const app = asRawApp(typed)

const server = createServer({
  app,
  live: true,
  middleware: [logger()],
  document: {
    title: "Potato CF",
    bodyAttrs: 'class="min-h-screen bg-slate-50 antialiased"',
    styles: [`<style>${tw}</style>`],
    scripts: [liveBootScript({ topic: "page", path: "/__potato/live" })],
    livePath: "/__potato/live",
  },
})

server.get("/api/health", (ctx) => ({
  ok: true,
  runtime: "cloudflare",
  hasDb: Boolean(ctx.env.DB),
}))

export default potatoWorker({
  server,
  live: {
    app,
    onEvent: (event, payload, session) => {
      Object.assign(app.state, session.state)
      app.emitter.emit(event, payload)
      Object.assign(session.state, app.state)
    },
  },
})
