import type { AppState, PotatoApp } from "@potato/core"
import type { ClientMessage, ServerMessage } from "./protocol.js"
import { decode, encode } from "./protocol.js"

export interface LiveSocket {
  send(data: string): void
  close(): void
}

export interface LiveSession {
  id: string
  topic: string
  href: string
  state: AppState
  socket: LiveSocket
}

export type LiveEventHandler = (
  event: string,
  payload: unknown,
  session: LiveSession,
) => void | Promise<void>

export interface LiveHubOptions {
  app: PotatoApp
  /** Called when a client joins — setup session state */
  onJoin?: (session: LiveSession) => void | Promise<void>
  /** Handle live events (like phx-click) */
  onEvent?: LiveEventHandler
  /** Serialize state to client */
  serializeState?: (state: AppState) => Record<string, unknown>
  /**
   * Shared state factory for multiplayer topics.
   * All sessions on the same topic share this object (cloned into session.state).
   */
  sharedState?: (topic: string) => Record<string, unknown>
  /** After an event, rebroadcast patch to every session on the topic. Default true. */
  broadcast?: boolean
}

/**
 * In-memory LiveView hub with multiplayer broadcast.
 * Wire to Cloudflare Durable Objects / Node ws as needed.
 */
export function createLiveHub(opts: LiveHubOptions) {
  const sessions = new Map<string, LiveSession>()
  const topicShared = new Map<string, Record<string, unknown>>()
  let seq = 0
  const shouldBroadcast = opts.broadcast !== false

  const serialize =
    opts.serializeState ??
    ((s: AppState) => {
      const { cache: _c, ...rest } = s as AppState & { cache?: unknown }
      try {
        return JSON.parse(JSON.stringify(rest)) as Record<string, unknown>
      } catch {
        return {
          href: s.href,
          route: s.route,
          params: s.params,
          query: s.query,
        }
      }
    })

  function getShared(topic: string): Record<string, unknown> {
    let s = topicShared.get(topic)
    if (!s) {
      s = opts.sharedState?.(topic) ?? {}
      topicShared.set(topic, s)
    }
    return s
  }

  function renderHtml(session: LiveSession): string {
    Object.assign(opts.app.state, session.state)
    return opts.app.toString(session.href, session.state)
  }

  function push(session: LiveSession, type: "ok" | "patch"): void {
    const html = renderHtml(session)
    const msg: ServerMessage = {
      type,
      topic: session.topic,
      html,
      state: serialize(session.state),
    }
    try {
      session.socket.send(encode(msg))
    } catch {
      /* closed */
    }
  }

  function syncFromShared(session: LiveSession): void {
    const shared = getShared(session.topic)
    Object.assign(session.state, shared)
  }

  function writeShared(session: LiveSession): void {
    const shared = getShared(session.topic)
    // copy enumerable own keys from session (skip framework keys lightly)
    for (const [k, v] of Object.entries(session.state)) {
      if (k === "cache" || k === "events") continue
      if (typeof v === "function") continue
      shared[k] = v as unknown
    }
  }

  /** Patch all sessions on a topic (multiplayer). */
  function broadcast(topic: string, patch?: (s: LiveSession) => void): void {
    for (const session of sessions.values()) {
      if (session.topic !== topic) continue
      if (patch) patch(session)
      else syncFromShared(session)
      push(session, "patch")
    }
  }

  async function handleMessage(
    socket: LiveSocket,
    raw: string,
  ): Promise<void> {
    let msg: ClientMessage
    try {
      msg = decode<ClientMessage>(raw)
    } catch {
      socket.send(encode({ type: "error", message: "invalid json" }))
      return
    }

    if (msg.type === "ping") {
      socket.send(encode({ type: "pong" }))
      return
    }

    if (msg.type === "join") {
      const id = `live_${++seq}`
      const shared = getShared(msg.topic)
      const state = {
        ...opts.app.state,
        ...shared,
        href: new URL(msg.href, "http://local").pathname,
      } as AppState
      const session: LiveSession = {
        id,
        topic: msg.topic,
        href: msg.href,
        state,
        socket,
      }
      if (msg.params) Object.assign(session.state.params, msg.params)
      sessions.set(id, session)
      ;(socket as LiveSocket & { _sessionId?: string })._sessionId = id
      if (opts.onJoin) await opts.onJoin(session)
      writeShared(session)
      push(session, "ok")
      return
    }

    const sessionId = (socket as LiveSocket & { _sessionId?: string })
      ._sessionId
    const session = sessionId ? sessions.get(sessionId) : undefined
    if (!session) {
      socket.send(encode({ type: "error", message: "no session" }))
      return
    }

    if (msg.type === "leave") {
      sessions.delete(session.id)
      return
    }

    if (msg.type === "event") {
      syncFromShared(session)
      Object.assign(opts.app.state, session.state)

      if (opts.onEvent) {
        await opts.onEvent(msg.event, msg.payload, session)
      } else {
        opts.app.emitter.emit(msg.event, msg.payload)
      }

      Object.assign(session.state, opts.app.state)
      writeShared(session)

      if (shouldBroadcast) {
        broadcast(session.topic)
      } else {
        push(session, "patch")
      }
    }
  }

  function disconnect(socket: LiveSocket): void {
    const id = (socket as LiveSocket & { _sessionId?: string })._sessionId
    if (id) sessions.delete(id)
  }

  return {
    handleMessage,
    disconnect,
    broadcast,
    getShared,
    sessions,
    async handleRaw(socket: LiveSocket, data: string | ArrayBuffer) {
      const raw =
        typeof data === "string" ? data : new TextDecoder().decode(data)
      await handleMessage(socket, raw)
    },
  }
}

export type LiveHub = ReturnType<typeof createLiveHub>
