/**
 * Multiplayer Trello — HTTP + WebSocket Live hub + client bundle.
 */
import { createServer, logger } from "potato-train-ssr"
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
import { getBoard, snapshot, addCard, moveCard, addList } from "./board.js"

const exampleRoot = exampleRootFromSrc(import.meta.url)
const tw = loadTailwindCss(exampleRootFrom(import.meta.url))

await bundleClient({
  entry: join(exampleRoot, "src/client.tsx"),
  exampleRoot,
  label: "trello",
  packages: ["core", "live"],
  jsx: false,
})

const app = createApp()
const TOPIC = "board"

const hub = createLiveHub({
  app,
  broadcast: true,
  sharedState: () => ({
    board: snapshot(),
    draft: "",
    activeList: getBoard().lists[0]!.id,
    peers: 0,
  }),
  onJoin: (session) => {
    session.state.board = snapshot() as never
    const shared = hub.getShared(TOPIC)
    shared.peers = (Number(shared.peers) || 0) + 1
    session.state.peers = shared.peers as never
  },
  onEvent: (event, payload, session) => {
    if (event === "card:add") {
      const p = payload as { title?: string; listId?: string }
      addCard(String(p.listId ?? ""), String(p.title ?? ""))
    } else if (event === "card:move") {
      const p = payload as { cardId?: string; toListId?: string }
      moveCard(String(p.cardId ?? ""), String(p.toListId ?? ""))
    } else if (event === "list:add") {
      const p = payload as { title?: string }
      addList(String(p.title ?? ""))
    }
    const shared = hub.getShared(TOPIC)
    shared.board = snapshot()
    session.state.board = shared.board as never
    session.state.peers = shared.peers as never
    // Render uses session.state via app.toString(href, session.state) — not app.state
  },
})

const potatoServer = createServer({
  app,
  middleware: [logger()],
  document: {
    title: "Potato Trello",
    bodyAttrs: 'class="min-h-screen bg-slate-950 text-slate-100 antialiased"',
    styles: [`<style>${tw}</style>`],
    clientEntry: "/assets/client.js",
    livePath: "/__potato/live",
  },
})

mountClientAssets(potatoServer, exampleRoot)

potatoServer.get("/api/board", () => snapshot())
potatoServer.get("/api/health", () => ({ ok: true, app: "trello" }))
potatoServer.page("/", () => ({
  board: snapshot(),
  peers: hub.getShared(TOPIC).peers ?? 1,
} as never))

const port = Number(process.env.PORT ?? 3030)
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
        const shared = hub.getShared(TOPIC)
        shared.peers = Math.max(0, Number(shared.peers || 1) - 1)
        hub.disconnect(liveSocket)
        hub.broadcast(TOPIC)
      })
    })
  } else {
    socket.destroy()
  }
})

httpServer.listen(port, () => {
  console.log(`
  🚂 Potato Trello (Live multiplayer)
     http://localhost:${port}/
     Open two windows — move/add cards; both update.
`)
})
