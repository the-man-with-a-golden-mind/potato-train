#!/usr/bin/env node
/**
 * potato deploy --cf  (minimal helper)
 * Usage: node scripts/deploy-cf.mjs [path-to-worker-example]
 */
import { spawnSync } from "node:child_process"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { existsSync } from "node:fs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const target = resolve(root, process.argv[2] ?? "examples/cloudflare")

if (!existsSync(target)) {
  console.error(`No project at ${target}`)
  process.exit(1)
}

console.log(`🚂 Deploying Potato Cloudflare worker from ${target}`)

const wrangler = spawnSync(
  "pnpm",
  ["exec", "wrangler", "deploy"],
  { cwd: target, stdio: "inherit", shell: true },
)

process.exit(wrangler.status ?? 1)
