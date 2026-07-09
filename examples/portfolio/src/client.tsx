/**
 * Browser entry — interactive portfolio (tick / refresh).
 */
import { createBrowserApp } from "./app.js"

const el = document.getElementById("app")
if (!el) throw new Error("#app missing")

const app = createBrowserApp()
app.mount(el)

// Sync from server (shared in-memory book)
void app.emit("dash:fetch")

console.info("[potato-portfolio] interactive: Simulate tick · Refresh")
