/**
 * Live multiplayer client — connectLive + morph patches.
 */
import { connectLive } from "@potato/live/client"

const proto = location.protocol === "https:" ? "wss" : "ws"
const url = `${proto}://${location.host}/__potato/live`

connectLive({
  url,
  topic: "board",
  root: "#app",
  debug: true,
})

console.info("[potato-trello] Live client ready · open two windows to collab")
