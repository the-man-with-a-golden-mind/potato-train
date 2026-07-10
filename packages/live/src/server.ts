import type { AppState, PotatoApp } from "potato-train-core"
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
  /**
   * Session-local state bag. Multiplayer fields live in topic shared state and
   * are synced into this object — **mutate this (or shared via writeShared),
   * never `app.state`**.
   */
  state: AppState
  socket: LiveSocket
}

/**
 * Handle a Live event for one session.
 * **Must mutate `session.state` only** (and topic shared state via hub helpers).
 * Do not touch `app.state` / `app.emitter` — that is the production model.
 */
export type LiveEventHandler = (
  event: string,
  payload: unknown,
  session: LiveSession,
) => void | Promise<void>

export interface LiveHubOptions {
  app: PotatoApp
  /** Called when a client joins — setup session state */
  onJoin?: (session: LiveSession) => void | Promise<void>
  /**
   * Required handler for Live events (`liveClick` / etc.).
   * Mutate `session.state` (and rely on topic `sharedState` for multiplayer).
   * There is **no** fallback to `app.emitter` — that path was a concurrency hazard.
   */
  onEvent: LiveEventHandler
  /** Serialize state to client */
  serializeState?: (state: AppState) => Record<string, unknown>
  /**
   * Shared state factory for multiplayer topics.
   * All sessions on the same topic share this object (merged into session.state).
   */
  sharedState?: (topic: string) => Record<string, unknown>
  /** After an event, rebroadcast patch to every session on the topic. Default true. */
  broadcast?: boolean
}

const FRAMEWORK_KEYS = new Set(["cache", "events"])

/**
 * In-memory LiveView hub with multiplayer broadcast.
 *
 * Production model:
 * 1. `onEvent(event, payload, session)` mutates **`session.state` only**
 * 2. Topic multiplayer uses `sharedState` + sync/write helpers
 * 3. HTML is `app.toString(href, session.state)` (pure, isolated snapshot)
 *
 * There is intentionally no `app.emitter` / `app.state` mutation path.
 */
export function createLiveHub(opts: LiveHubOptions) {
  if (typeof opts.onEvent !== "function") {
    throw new Error(
      "[potato/live] createLiveHub requires onEvent(event, payload, session). " +
        "Mutate session.state there — do not use app.emitter for Live events.",
    )
  }

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

  /** Pure render — isolated snapshot, no app.state writes. */
  function renderHtml(session: LiveSession): string {
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
    for (const [k, v] of Object.entries(session.state)) {
      if (FRAMEWORK_KEYS.has(k)) continue
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
      // Session bag from serializable app defaults + topic shared — no live app.state alias
      let base: Record<string, unknown> = {}
      try {
        const { cache: _c, events: _e, ...rest } = opts.app.state
        base = JSON.parse(JSON.stringify(rest)) as Record<string, unknown>
      } catch {
        base = {
          href: opts.app.state.href,
          route: opts.app.state.route,
          title: opts.app.state.title,
        }
      }
      const state = {
        ...base,
        ...shared,
        href: new URL(msg.href, "http://local").pathname,
        params: { ...(opts.app.state.params ?? {}) },
        query: { ...(opts.app.state.query ?? {}) },
        events: opts.app.state.events,
        cache: opts.app.state.cache,
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
      // Production path only: mutate session.state in onEvent
      await opts.onEvent(msg.event, msg.payload, session)
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
