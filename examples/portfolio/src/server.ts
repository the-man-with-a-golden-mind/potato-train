import { createServer, logger, cors } from "potato-train-ssr"
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
import { createApp } from "./app.js"
import {
  getPortfolio,
  totals,
  bySector,
  tickPrices,
  updateHolding,
} from "./data.js"

const exampleRoot = exampleRootFromSrc(import.meta.url)
const tw = loadTailwindCss(exampleRootFrom(import.meta.url))

await bundleClient({
  entry: join(exampleRoot, "src/client.tsx"),
  exampleRoot,
  label: "portfolio",
  packages: ["core", "jsx"],
})

// Shell only — interactive UI mounts from client.js
const app = createApp()

const server = createServer({
  app,
  middleware: [logger(), cors({ origin: "*" })],
  document: {
    title: "Portfolio · Potato",
    bodyAttrs: 'class="min-h-screen bg-slate-950 text-slate-100 antialiased"',
    styles: [`<style>${tw}</style>`],
    clientEntry: "/assets/client.js",
  },
})

function payload() {
  const portfolio = getPortfolio()
  return {
    portfolio,
    stats: totals(portfolio),
    sectors: bySector(portfolio),
  }
}

mountClientAssets(server, exampleRoot)

server.get("/api/health", () => ({ ok: true, app: "portfolio" }))
server.get("/api/portfolio", () => payload())

server.post("/api/portfolio/tick", () => {
  tickPrices()
  return { ok: true, ...payload() }
})

server.patch("/api/portfolio/holdings/:symbol", async (ctx) => {
  const body = (await ctx.req.json()) as { shares?: number; price?: number }
  updateHolding(ctx.params.symbol!, body)
  return payload()
})

const port = Number(process.env.PORT ?? 3020)
const http = await server.listen(port)
console.log(`
  Portfolio dashboard (interactive):
    ${http.url}/

  Simulate tick · Refresh — client bundle + API
`)
