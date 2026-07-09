/**
 * Browser entry — full interactive sheet (typed createApp).
 */
import { createSheetApp } from "./app.js"

const app = createSheetApp()
const el = document.getElementById("app")
if (!el) throw new Error("#app missing")
app.mount(el)

console.info(
  "[potato-sheet] scroll · click select · double-click/F2 edit · arrows · Del clear",
)
