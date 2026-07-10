import { morphHtml } from "potato-train-core"
import type { ClientMessage, ServerMessage } from "./protocol.js"
import { decode, encode } from "./protocol.js"

export interface LiveClientOptions {
  /** WebSocket URL, e.g. wss://app/__potato/live */
  url: string
  /** Topic / channel name */
  topic?: string
  /** DOM root to morph (default #app) */
  root?: string | Element
  /** Called when state patch arrives */
  onState?: (state: Record<string, unknown>) => void
  /** Reconnect delay ms */
  reconnectMs?: number
  debug?: boolean
}

/**
 * Browser LiveView client.
 * Uses real-DOM morph (not innerHTML wipe) to preserve focus where possible.
 */
export function connectLive(opts: LiveClientOptions) {
  const topic = opts.topic ?? "page"
  const reconnectMs = opts.reconnectMs ?? 1500
  let ws: WebSocket | null = null
  let closed = false
  let rootEl: Element | null = null

  const log = (...a: unknown[]) => {
    if (opts.debug) console.log("[potato/live]", ...a)
  }

  function getRoot(): Element {
    if (rootEl) return rootEl
    if (typeof opts.root === "string" || opts.root == null) {
      rootEl = document.querySelector(
        typeof opts.root === "string" ? opts.root : "#app",
      )
    } else {
      rootEl = opts.root
    }
    if (!rootEl) throw new Error("[potato/live] root not found")
    return rootEl
  }

  function applyHtml(html: string): void {
    const root = getRoot()
    morphHtml(root, html)
    bindLiveHandlers(root)
  }

  function bindLiveHandlers(root: Element): void {
    // Event delegation — survives morph better than per-node handlers
    if ((root as HTMLElement & { _potatoLiveBound?: boolean })._potatoLiveBound) {
      return
    }
    ;(root as HTMLElement & { _potatoLiveBound?: boolean })._potatoLiveBound = true

    root.addEventListener("click", (e) => {
      const el = (e.target as Element | null)?.closest?.(
        "[data-potato-click]",
      ) as HTMLElement | null
      if (!el || !root.contains(el)) return
      e.preventDefault()
      const event = el.getAttribute("data-potato-click")!
      const payloadRaw = el.getAttribute("data-potato-value")
      let payload: unknown = undefined
      if (payloadRaw) {
        try {
          payload = JSON.parse(payloadRaw)
        } catch {
          payload = payloadRaw
        }
      }
      send({ type: "event", topic, event, payload })
    })

    root.addEventListener("submit", (e) => {
      const form = (e.target as Element | null)?.closest?.(
        "form[data-potato-submit]",
      ) as HTMLFormElement | null
      if (!form || !root.contains(form)) return
      e.preventDefault()
      const event = form.getAttribute("data-potato-submit")!
      const fd = new FormData(form)
      const payload: Record<string, string> = {}
      fd.forEach((value, key) => {
        payload[key] = String(value)
      })
      send({ type: "event", topic, event, payload })
    })

    root.addEventListener("change", (e) => {
      const el = e.target as HTMLElement | null
      if (!el?.hasAttribute?.("data-potato-change")) return
      const event = el.getAttribute("data-potato-change")!
      const value =
        "value" in el ? (el as HTMLInputElement).value : undefined
      send({ type: "event", topic, event, payload: { value } })
    })
  }

  /** Queue until socket is OPEN (avoids silent drops on early clicks). */
  const outbound: ClientMessage[] = []
  let joined = false

  function flush(): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    while (outbound.length) {
      ws.send(encode(outbound.shift()!))
    }
  }

  function send(msg: ClientMessage): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(encode(msg))
    } else {
      outbound.push(msg)
    }
  }

  function connect(): void {
    if (closed) return
    joined = false
    ws = new WebSocket(opts.url)

    ws.onopen = () => {
      log("open")
      // Join first, then flush any queued user events
      ws!.send(
        encode({
          type: "join",
          topic,
          href: location.pathname + location.search,
        }),
      )
      joined = true
      flush()
      try {
        bindLiveHandlers(getRoot())
      } catch {
        /* root may not exist yet */
      }
    }

    ws.onmessage = (ev) => {
      const msg = decode<ServerMessage>(String(ev.data))
      log("←", msg.type)
      if (msg.type === "ok" || msg.type === "patch") {
        applyHtml(msg.html)
        if (msg.state && opts.onState) opts.onState(msg.state)
      } else if (msg.type === "redirect") {
        location.href = msg.href
      } else if (msg.type === "error") {
        console.error("[potato/live]", msg.message)
      }
    }

    ws.onclose = () => {
      log("close")
      joined = false
      if (!closed) setTimeout(connect, reconnectMs)
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  connect()

  const ping = setInterval(() => {
    if (joined) send({ type: "ping" })
  }, 25_000)

  return {
    sendEvent(event: string, payload?: unknown) {
      send({ type: "event", topic, event, payload })
    },
    disconnect() {
      closed = true
      clearInterval(ping)
      ws?.close()
    },
    get socket() {
      return ws
    },
  }
}

/** Helper to mark clickable live elements in views (SSR + client). */
export function liveClick(
  event: string,
  value?: unknown,
): Record<string, string> {
  const attrs: Record<string, string> = {
    "data-potato-click": event,
  }
  if (value !== undefined) {
    attrs["data-potato-value"] =
      typeof value === "string" ? value : JSON.stringify(value)
  }
  return attrs
}

export function liveSubmit(event: string): Record<string, string> {
  return { "data-potato-submit": event }
}

export function liveChange(event: string): Record<string, string> {
  return { "data-potato-change": event }
}
