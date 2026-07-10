import { createServer, logger } from "potato-train-ssr"
import { createLiveHub } from "potato-train-live"
import { createServer as createHttpServer } from "node:http"
import { WebSocketServer } from "ws"
import crypto from "crypto"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"

import {
  createApp,
  isBomb,
  getNeighborMines,
  GRID_ROWS,
  GRID_COLS,
  type CellState,
  type LockState,
  type SaperState,
} from "./app.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, "..")

// Server PoW settings
const CHALLENGE = "potato-saper-challenge-789"
const DIFFICULTY = 3 // 3 hex zeros = ~4096 tries, extremely fast yet anti-spam

// BFS Cascading reveal for 0-neighbor spaces
function cascadeReveal(
  seed: string,
  startR: number,
  startC: number,
  revealed: Record<string, CellState>,
  locks: Record<string, LockState>,
  nickname: string,
) {
  const queue: [number, number][] = [[startR, startC]]
  const visited = new Set<string>([`${startR}:${startC}`])
  let count = 0

  while (queue.length > 0 && count < 200) {
    const [r, c] = queue.shift()!
    const key = `${r}:${c}`

    revealed[key] = { type: "open", player: nickname }
    count++

    const mines = getNeighborMines(seed, r, c, GRID_ROWS, GRID_COLS)
    if (mines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
            const nkey = `${nr}:${nc}`
            if (visited.has(nkey)) continue
            visited.add(nkey)

            if (isBomb(seed, nr, nc)) continue
            if (revealed[nkey]) continue
            
            const lock = locks[nkey]
            if (lock && lock.expiresAt > Date.now() && lock.lockedBy !== nickname) {
              continue
            }

            queue.push([nr, nc])
          }
        }
      }
    }
  }
}

// Instantiate Potato App
const app = createApp()

// Set default pow options
app.state.challenge = CHALLENGE
app.state.difficulty = DIFFICULTY

const potatoServer = createServer({
  app,
  middleware: [logger()],
  document: {
    title: "Multiplayer Saper 💣",
    bodyAttrs: 'class="bg-teal-800 text-black"',
    styles: [`<style>${fs.readFileSync(path.join(appRoot, "src/styles.css"), "utf-8")}</style>`],
    clientEntry: "/assets/client.js",
    livePath: "/__potato/live",
  },
})

// Custom static client assets route if built (similar to trello example)
potatoServer.get("/assets/client.js", async (ctx) => {
  // During dev, tsx will watch or esbuild will bundle on startup. Let's compile client.tsx using esbuild on startup.
  const clientPath = path.join(appRoot, "src/client.tsx")
  const esbuild = await import("esbuild")
  const res = await esbuild.build({
    entryPoints: [clientPath],
    bundle: true,
    write: false,
    format: "esm",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "potato-train-jsx",
    loader: { ".tsx": "tsx" },
    alias: {
      "potato-train-core": path.resolve(appRoot, "../../packages/core/src/index.ts"),
      "potato-train-live/client": path.resolve(appRoot, "../../packages/live/src/client.ts"),
      "potato-train-virtual": path.resolve(appRoot, "../../packages/virtual/src/index.ts"),
      "potato-train-jsx/jsx-runtime": path.resolve(appRoot, "../../packages/jsx/src/jsx-runtime.ts"),
      "potato-train-jsx/jsx-dev-runtime": path.resolve(appRoot, "../../packages/jsx/src/jsx-dev-runtime.ts"),
      "potato-train-jsx": path.resolve(appRoot, "../../packages/jsx/src/index.ts"),
    },
  })
  return new Response(res.outputFiles[0]!.text, {
    headers: { "content-type": "application/javascript" },
  })
})

potatoServer.page("/", () => ({
  challenge: CHALLENGE,
  difficulty: DIFFICULTY,
} as never))

// Create LiveView Hub
const liveHub = createLiveHub({
  app,
  broadcast: true,
  sharedState: () => ({
    revealed: {},
    locks: {},
  }),
  onEvent: async (event, payload, session) => {
    const sState = session.state as unknown as SaperState

    // 1. Join verification
    if (event === "saper:join") {
      const { nickname, nonce } = payload as { nickname: string; nonce: string }
      if (!nickname || !nonce) return

      // Verify Proof of Work
      const prefix = nickname + CHALLENGE
      const hash = crypto
        .createHash("sha256")
        .update(prefix + nonce)
        .digest("hex")

      const targetZeros = "0".repeat(DIFFICULTY)
      if (hash.startsWith(targetZeros)) {
        sState.nickname = nickname
        sState.dead = false
        console.log(`[saper] Player joined: "${nickname}" (nonce: ${nonce})`)
      } else {
        console.warn(`[saper] Blocked invalid PoW connection from: "${nickname}"`)
      }
      return
    }

    // Require nickname for all following events
    if (!sState.nickname) return

    // If player is dead, they can only request revive
    if (sState.dead) {
      if (event === "saper:revive") {
        const { nonce } = payload as { nonce: string }
        if (!nonce) return

        // Verify heavy PoW (difficulty 5)
        const prefix = sState.nickname + CHALLENGE + "revive"
        const hash = crypto
          .createHash("sha256")
          .update(prefix + nonce)
          .digest("hex")

        const targetZeros = "0".repeat(5) // Heavy challenge target
        if (hash.startsWith(targetZeros)) {
          sState.dead = false
          sState.cooldown = 0
          console.log(`[saper] Player "${sState.nickname}" revived successfully (nonce: ${nonce})`)
        } else {
          console.warn(`[saper] Blocked invalid revive PoW from "${sState.nickname}"`)
        }
      }
      return
    }

    // 2. Click to Reveal
    if (event === "saper:reveal") {
      const { r, c } = payload as { r: number; c: number }
      
      // Cooldown check
      if (sState.cooldown > Date.now()) {
        return
      }

      // Check if already open
      const key = `${r}:${c}`
      if (sState.revealed[key]?.type === "open") return

      // Check locks
      const lock = sState.locks[key]
      if (lock && lock.expiresAt > Date.now() && lock.lockedBy !== sState.nickname) {
        return
      }

      // Apply cooldown (5s)
      sState.cooldown = Date.now() + 5000

      // Check if bomb
      const hit = isBomb(sState.seed, r, c)
      if (hit) {
        sState.dead = true
        sState.revealed[key] = { type: "open", player: sState.nickname }
        console.log(`[saper] Player "${sState.nickname}" hit a bomb at (${r}, ${c})!`)
      } else {
        // Lock this cell and neighbors for 10s
        const expiresAt = Date.now() + 10000
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr
            const nc = c + dc
            if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
              sState.locks[`${nr}:${nc}`] = {
                lockedBy: sState.nickname,
                expiresAt,
              }
            }
          }
        }

        // Perform reveal (cascade if 0 neighbor mines)
        cascadeReveal(
          sState.seed,
          r,
          c,
          sState.revealed,
          sState.locks,
          sState.nickname,
        )
      }
      return
    }

    // 3. Right Click to Flag (requires PoW, difficulty 3)
    if (event === "saper:flag") {
      const { r, c, nonce } = payload as { r: number; c: number; nonce: string }
      if (!nonce) return

      // Verify flagging PoW
      const prefix = sState.nickname + CHALLENGE + `flag:${r}:${c}`
      const hash = crypto
        .createHash("sha256")
        .update(prefix + nonce)
        .digest("hex")

      const targetZeros = "0".repeat(DIFFICULTY)
      if (!hash.startsWith(targetZeros)) {
        console.warn(`[saper] Blocked invalid flag PoW from "${sState.nickname}"`)
        return
      }

      const key = `${r}:${c}`
      const existing = sState.revealed[key]

      if (existing) {
        if (existing.type === "flag" && existing.player === sState.nickname) {
          delete sState.revealed[key]
        }
      } else {
        sState.revealed[key] = { type: "flag", player: sState.nickname }
      }
      return
    }

    // 4. Smiley Reset Button (disabled when dead, only resets cooldown if alive)
    if (event === "saper:reset") {
      sState.cooldown = 0
      return
    }
  },
})

// Create Native HTTP Server and route request to Potato pipeline
const port = Number(process.env.PORT ?? 3040)
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

// Bind express WebSocket upgrade to Potato live hub
const wss = new WebSocketServer({ noServer: true })

httpServer.on("upgrade", (req, socket, head) => {
  if (req.url === "/__potato/live") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      const liveSocket = {
        send: (data: string) => {
          if (ws.readyState === ws.OPEN) ws.send(data)
        },
        close: () => ws.close(),
      }
      ws.on("message", (data) => {
        void liveHub.handleRaw(liveSocket, data as string | ArrayBuffer)
      })
      ws.on("close", () => {
        liveHub.disconnect(liveSocket)
      })
    })
  } else {
    socket.destroy()
  }
})

httpServer.listen(port, () => {
  console.log(`
  💣 Multiplayer Saper Game Running!
     http://localhost:${port}/
     Open multiple windows to test real-time collaboration.
  `)
})

// Prune expired locks periodically (every 5 seconds)
setInterval(() => {
  const shared = liveHub.getShared("saper-global")
  const locks = (shared.locks as Record<string, LockState>) || {}
  const now = Date.now()
  let modified = false

  for (const [key, lock] of Object.entries(locks)) {
    if (lock.expiresAt < now) {
      delete locks[key]
      modified = true
    }
  }

  if (modified) {
    liveHub.broadcast("saper-global")
  }
}, 5000)
