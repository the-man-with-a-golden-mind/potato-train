/**
 * Live client for SSR todos — WebSocket morph patches.
 */
import { connectLive } from "potato-train-live/client"

const proto = location.protocol === "https:" ? "wss" : "ws"
connectLive({
  url: `${proto}://${location.host}/__potato/live`,
  topic: "todos",
  root: "#app",
  debug: true,
})

console.info("[potato-ssr] Live client ready")
