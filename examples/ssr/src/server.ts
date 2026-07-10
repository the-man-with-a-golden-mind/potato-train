/**
 * SSR + Live todos — HTTP, WebSocket hub, client Live bundle.
 */
import { createServer, logger, cors } from "potato-train-ssr"
import { createAuth, hashPassword, verifyPassword, getAuth } from "potato-train-auth"
import { createLiveHub } from "potato-train-live"
import { createServer as createHttpServer } from "node:http"
import { join } from "node:path"
import { WebSocketServer } from "ws"
import {
  bundleClient,
  exampleRootFromSrc,
  mountClientAssets,
} from "../../_shared/bundle-client.js"
import {
  exampleRootFrom,
  loadTailwindCss,
} from "../../_shared/load-tailwind.js"
import { createApp } from "./app.js"

const exampleRoot = exampleRootFromSrc(import.meta.url)
const tw = loadTailwindCss(exampleRootFrom(import.meta.url))

await bundleClient({
  entry: join(exampleRoot, "src/client.tsx"),
  exampleRoot,
  label: "ssr",
  packages: ["core", "live"],
  jsx: false,
})

const app = createApp()
const TOPIC = "todos"

const users = new Map([
  [
    "1",
    {
      id: "1",
      email: "demo@potato.dev",
      name: "Demo",
      passwordHash: await hashPassword("potato"),
    },
  ],
])

const auth = createAuth({
  secure: false,
  getUser: async (id) => {
    const u = users.get(id)
    if (!u) return null
    return { id: u.id, email: u.email, name: u.name }
  },
})

const hub = createLiveHub({
  app,
  broadcast: true,
  sharedState: () => ({
    todos: [
      { id: 1, text: "Ship Potato SSR", done: false },
      { id: 2, text: "Add LiveView patches", done: true },
    ],
    draft: "",
  }),
  onJoin: (session) => {
    const shared = hub.getShared(TOPIC)
    Object.assign(session.state, shared)
  },
  onEvent: (event, payload, session) => {
    // Production model: mutate session.state only (never app.state / app.emitter)
    const s = session.state as {
      todos: { id: number; text: string; done: boolean }[]
      draft: string
    }
    if (event === "todo:toggle") {
      const id = Number(payload)
      s.todos = s.todos.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t,
      )
    } else if (event === "todo:add") {
      const value = String(payload ?? s.draft).trim()
      if (value) {
        s.todos = [...s.todos, { id: Date.now(), text: value, done: false }]
        s.draft = ""
      }
    } else if (event === "todo:draft") {
      s.draft = String(payload ?? "")
    }
  },
})

const potatoServer = createServer({
  app,
  middleware: [logger(), cors({ origin: "*" }), auth.middleware],
  document: {
    title: "Potato SSR",
    bodyAttrs: 'class="min-h-screen bg-slate-950 text-slate-100 antialiased"',
    styles: [`<style>${tw}</style>`],
    clientEntry: "/assets/client.js",
    livePath: "/__potato/live",
  },
})

mountClientAssets(potatoServer, exampleRoot)

potatoServer.get("/api/health", () => ({ ok: true, framework: "potato" }))

potatoServer.post("/api/login", async (ctx) => {
  const body = (await ctx.req.json()) as { email?: string; password?: string }
  const user = [...users.values()].find((u) => u.email === body.email)
  if (!user || !(await verifyPassword(body.password ?? "", user.passwordHash))) {
    return ctx.json({ error: "Invalid credentials" }, 401)
  }
  await getAuth(ctx).login(user.id)
  return { ok: true, user: { id: user.id, email: user.email } }
})

potatoServer.get("/api/me", (ctx) => {
  const user = ctx.locals.user
  if (!user) return ctx.json({ user: null })
  return { user }
})

const port = Number(process.env.PORT ?? 3000)
const httpServer = createHttpServer(async (req, res) => {
  try {
    const host = req.headers.host ?? `localhost:${port}`
    const url = `http://${host}${req.url ?? "/"}`
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x))
      else headers.set(k, v)
    }
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    }
    const body =
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : Buffer.concat(chunks)
    const request = new Request(url, {
      method: req.method,
      headers,
      body: body?.length ? new Uint8Array(body) : undefined,
    })
    const response = await potatoServer.fetch(request)
    res.statusCode = response.status
    response.headers.forEach((v, k) => res.setHeader(k, v))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (e) {
    console.error(e)
    res.statusCode = 500
    res.end("error")
  }
})

const wss = new WebSocketServer({ noServer: true })
httpServer.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/__potato/live")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      const liveSocket = {
        send: (data: string) => {
          if (ws.readyState === ws.OPEN) ws.send(data)
        },
        close: () => ws.close(),
      }
      ws.on("message", (data) => {
        void hub.handleMessage(liveSocket, String(data))
      })
      ws.on("close", () => {
        hub.disconnect(liveSocket)
      })
    })
  } else {
    socket.destroy()
  }
})

httpServer.listen(port, () => {
  console.log(`
  Potato SSR + Live:
    http://localhost:${port}/
  Toggle todos / Add — Live WebSocket morph
  Login: POST /api/login {"email":"demo@potato.dev","password":"potato"}
`)
})
