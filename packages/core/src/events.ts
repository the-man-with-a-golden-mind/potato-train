/** Built-in framework events (Choo-compatible names + potato extensions). */
export const EVENTS = {
  DOMCONTENTLOADED: "DOMContentLoaded",
  RENDER: "render",
  NAVIGATE: "navigate",
  PUSHSTATE: "pushState",
  REPLACESTATE: "replaceState",
  POPSTATE: "popState",
  DOMTITLECHANGE: "DOMTitleChange",
  /** Potato: live socket patch applied */
  LIVEPATCH: "live:patch",
  /** Potato: live event from client → server */
  LIVEEVENT: "live:event",
  /** Potato: error boundary */
  ERROR: "error",
  /** Potato: store/middleware debug */
  TRACE: "trace",
} as const

export type EventName = (typeof EVENTS)[keyof typeof EVENTS]
