/**
 * Compile Tailwind for non-Vite Potato examples.
 * Resolves CLI from the example, then monorepo root (shared install).
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export function exampleRootFrom(metaUrl: string): string {
  return join(dirname(fileURLToPath(metaUrl)), "..")
}

function findTailwindBin(from: string): string {
  let dir = from
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, "node_modules/.bin/tailwindcss")
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return "tailwindcss"
}

export function loadTailwindCss(exampleRoot: string): string {
  const input = join(exampleRoot, "src/styles.css")
  const outDir = join(exampleRoot, "dist")
  const output = join(outDir, "styles.css")
  mkdirSync(outDir, { recursive: true })

  const bin = findTailwindBin(exampleRoot)
  execFileSync(bin, ["-i", input, "-o", output, "--minify"], {
    cwd: exampleRoot,
    stdio: ["ignore", "pipe", "pipe"],
  })

  return readFileSync(output, "utf8")
}
