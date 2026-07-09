#!/usr/bin/env node
/**
 * Fail CI if package bundles exceed budgets (gzip approximate via raw size).
 * Budgets are raw ESM dist sizes in bytes.
 */
import { readFileSync, existsSync, statSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** raw max / gzip max (bytes) */
const budgets = {
  "packages/core/dist/index.js": { raw: 45_000, gzip: 14_000 },
  "packages/jsx/dist/jsx-runtime.js": { raw: 2_000, gzip: 800 },
  "packages/formula/dist/index.js": { raw: 20_000, gzip: 6_000 },
  "packages/virtual/dist/index.js": { raw: 5_000, gzip: 2_000 },
  "packages/live/dist/client.js": { raw: 8_000, gzip: 3_000 },
  "packages/ssr/dist/index.js": { raw: 30_000, gzip: 10_000 },
}

let failed = false
console.log("Potato size budget\n")

for (const [rel, budget] of Object.entries(budgets)) {
  const path = resolve(root, rel)
  if (!existsSync(path)) {
    console.log(`  SKIP  ${rel} (missing — run pnpm build)`)
    continue
  }
  const raw = statSync(path).size
  const gz = gzipSync(readFileSync(path)).length
  const rawOk = raw <= budget.raw
  const gzOk = gz <= budget.gzip
  const mark = rawOk && gzOk ? "OK  " : "FAIL"
  if (!rawOk || !gzOk) failed = true
  console.log(
    `  ${mark} ${rel}\n        raw ${raw} / ${budget.raw}   gzip ${gz} / ${budget.gzip}`,
  )
}

console.log("")
if (failed) {
  console.error("Size budget exceeded.")
  process.exit(1)
}
console.log("All budgets within limits.")
