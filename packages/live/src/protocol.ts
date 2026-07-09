/**
 * Live protocol (Phoenix LiveView inspired, JSON over WebSocket).
 *
 * Client → Server:
 *   { type: 'join', topic, href, params? }
 *   { type: 'event', topic, event, payload }
 *   { type: 'leave', topic }
 *
 * Server → Client:
 *   { type: 'ok', topic, html, state? }
 *   { type: 'patch', topic, html, state? }
 *   { type: 'redirect', href }
 *   { type: 'error', message }
 */

export type ClientMessage =
  | { type: "join"; topic: string; href: string; params?: Record<string, string> }
  | { type: "event"; topic: string; event: string; payload?: unknown }
  | { type: "leave"; topic: string }
  | { type: "ping" }

export type ServerMessage =
  | {
      type: "ok" | "patch"
      topic: string
      html: string
      state?: Record<string, unknown>
    }
  | { type: "redirect"; href: string }
  | { type: "error"; message: string }
  | { type: "pong" }

export function encode(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg)
}

export function decode<T = ClientMessage | ServerMessage>(raw: string): T {
  return JSON.parse(raw) as T
}
