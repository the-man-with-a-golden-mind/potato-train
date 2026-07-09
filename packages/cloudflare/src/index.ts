import type { PotatoServer } from "@potato/ssr"
import { createLiveHub, type LiveHub, type LiveHubOptions } from "@potato/live"

export interface CloudflareEnv {
  [key: string]: unknown
}

export interface WorkerOptions {
  server: PotatoServer
  /** LiveView hub options — enables WS upgrade on livePath */
  live?: LiveHubOptions & { path?: string }
}

/**
 * Create a Cloudflare Workers export:
 * ```ts
 * export default potatoWorker({ server, live: { app } })
 * ```
 */
export function potatoWorker(opts: WorkerOptions) {
  const livePath = opts.live?.path ?? "/__potato/live"
  const hub: LiveHub | null = opts.live
    ? createLiveHub(opts.live)
    : null

  return {
    async fetch(
      request: Request,
      env: CloudflareEnv,
      _ctx: { waitUntil(p: Promise<unknown>): void },
    ): Promise<Response> {
      const url = new URL(request.url)

      // WebSocket upgrade for LiveView
      if (
        hub &&
        url.pathname === livePath &&
        request.headers.get("Upgrade")?.toLowerCase() === "websocket"
      ) {
        return handleWebSocket(request, hub)
      }

      return opts.server.fetch(request, env as Record<string, unknown>)
    },
  }
}

function handleWebSocket(request: Request, hub: LiveHub): Response {
  const pair = new WebSocketPair()
  const client = pair[0]
  const server = pair[1]

  server.accept()

  const socket = {
    send(data: string) {
      /* v8 ignore next 3 */
      try {
        server.send(data)
      } catch {
        /* closed */
      }
    },
    close() {
      /* v8 ignore next 3 */
      try {
        server.close()
      } catch {
        /* */
      }
    },
  }

  server.addEventListener("message", (event) => {
    const data =
      typeof event.data === "string"
        ? event.data
        : new TextDecoder().decode(event.data as ArrayBuffer)
    void hub.handleMessage(socket, data)
  })

  server.addEventListener("close", () => {
    hub.disconnect(socket)
  })

  try {
    return new Response(null, {
      status: 101,
      // @ts-expect-error CF runtime — webSocket is Workers-only
      webSocket: client,
    })
  } catch {
    // Node/undici reject status 101; CF Workers accept it
    return new Response("WebSocket upgrade requires Cloudflare Workers runtime", {
      status: 426,
      headers: { upgrade: "websocket" },
    })
  }
}

/** Declare WebSocketPair for typecheck without CF types */
declare class WebSocketPair {
  0: WebSocket
  1: WebSocket & { accept(): void }
}

/**
 * Static asset helper for Workers Sites / assets binding.
 */
export async function serveAssets(
  request: Request,
  assets: { fetch(req: Request): Promise<Response> },
): Promise<Response | null> {
  const url = new URL(request.url)
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/static/") ||
    /\.[\w]+$/.test(url.pathname)
  ) {
    const res = await assets.fetch(request)
    if (res.status !== 404) return res
  }
  return null
}
