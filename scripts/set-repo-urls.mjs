#!/usr/bin/env node
/**
 * Set repository/bugs/homepage on all public packages.
 * Usage: node scripts/set-repo-urls.mjs https://github.com/USER/potato-train
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const base = (process.argv[2] || "").replace(/\.git$/, "")
if (!base.startsWith("http")) {
  console.error("Usage: node scripts/set-repo-urls.mjs https://github.com/USER/REPO")
  process.exit(1)
}

for (const d of readdirSync(join(root, "packages"))) {
  const p = join(root, "packages", d, "package.json")
  if (!existsSync(p)) continue
  const j = JSON.parse(readFileSync(p, "utf8"))
  if (j.private) continue
  j.repository = {
    type: "git",
    url: `${base}.git`,
    directory: `packages/${d}`,
  }
  j.bugs = { url: `${base}/issues` }
  j.homepage = `${base}#readme`
  writeFileSync(p, JSON.stringify(j, null, 2) + "\n")
  console.log("updated", j.name)
}
