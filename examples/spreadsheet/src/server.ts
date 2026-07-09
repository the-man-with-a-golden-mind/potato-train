import { createServer, logger, cors, documentHtml } from "@potato/ssr"
import { join } from "node:path"
import {
  bundleClient,
  exampleRootFromSrc,
  mountClientAssets,
} from "../../_shared/bundle-client.js"
import {
  exampleRootFrom,
  loadTailwindCss,
} from "../../_shared/load-tailwind.js"
import {
  getSheet,
  getWindow,
  setCell,
  setCells,
  ensureHugeSample,
} from "./sheet-store.js"

ensureHugeSample("demo")

const exampleRoot = exampleRootFromSrc(import.meta.url)
const css = loadTailwindCss(exampleRootFrom(import.meta.url))

await bundleClient({
  entry: join(exampleRoot, "src/client.tsx"),
  exampleRoot,
  label: "sheet",
  packages: ["core", "jsx", "virtual", "formula"],
})

const { potato } = await import("@potato/core")
const shellApp = potato()
shellApp.route("/", () => ({
  type: "div",
  props: { class: "status-bar", children: "Loading spreadsheet…" },
}))

const server = createServer({
  app: shellApp,
  middleware: [logger(), cors({ origin: "*" })],
})

server.get("/", async (ctx) =>
  ctx.html(
    documentHtml("", {
      title: "Potato Spreadsheet",
      styles: [`<style>${css}</style>`],
      clientEntry: "/assets/client.js",
      rootId: "app",
    }),
  ),
)

mountClientAssets(server, exampleRoot)

server.get("/api/health", () => ({ ok: true, app: "spreadsheet" }))

server.get("/api/sheets/:id", (ctx) => {
  const sheet = getSheet(ctx.params.id)
  return {
    meta: sheet.meta,
    updatedAt: sheet.updatedAt,
    cellCount: Object.keys(sheet.raw).length,
  }
})

/** Single cell raw+value for edit bar */
server.get("/api/sheets/:id/cells/:key", (ctx) => {
  const sheet = getSheet(ctx.params.id)
  const key = ctx.params.key!.toUpperCase()
  return {
    key,
    raw: sheet.raw[key] ?? "",
    value: sheet.values[key] ?? sheet.raw[key] ?? "",
  }
})

server.get("/api/sheets/:id/window", (ctx) => {
  const rowStart = Number(ctx.query.rowStart ?? 0)
  const rowCount = Math.min(300, Math.max(1, Number(ctx.query.rowCount ?? 60)))
  const colStart = Number(ctx.query.colStart ?? 0)
  const colCount = Math.min(26, Math.max(1, Number(ctx.query.colCount ?? 12)))
  return getWindow(ctx.params.id!, rowStart, rowCount, colStart, colCount)
})

server.patch("/api/sheets/:id/cells/:key", async (ctx) => {
  const body = (await ctx.req.json()) as { value?: string }
  const sheet = setCell(ctx.params.id!, ctx.params.key!, body.value ?? "")
  const key = ctx.params.key!.toUpperCase()
  return {
    key,
    raw: sheet.raw[key] ?? "",
    value: sheet.values[key] ?? "",
    updatedAt: sheet.updatedAt,
  }
})

server.put("/api/sheets/:id/cells", async (ctx) => {
  const body = (await ctx.req.json()) as { cells: Record<string, string> }
  const sheet = setCells(ctx.params.id!, body.cells ?? {})
  return {
    updatedAt: sheet.updatedAt,
    count: Object.keys(body.cells ?? {}).length,
  }
})

const port = Number(process.env.PORT ?? 3010)
const http = await server.listen(port)
console.log(`
  Potato Sheet (Excel-like):
    ${http.url}/

  Click = select · Double-click / F2 = edit (raw formula)
  Arrows navigate · Enter/Tab commit+move · Del clear · Drag header edge resize
`)
