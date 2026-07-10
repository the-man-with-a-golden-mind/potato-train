#!/usr/bin/env node
/**
 * Run vitest for one workspace package from monorepo root config.
 *
 * Usage (from packages/NAME):
 *   node ../../scripts/test-package.mjs
 *
 * Root vitest include paths are monorepo-relative (packages/NAME/tests),
 * so package-local "vitest run --dir tests" finds nothing. This script always
 * runs from the repo root with an explicit package test glob.
 */
import { spawnSync } from "node:child_process"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { existsSync } from "node:fs"

const pkgDir = process.cwd()
const pkgName = basename(pkgDir)
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const config = join(root, "vitest.config.ts")
const testsDir = join(root, "packages", pkgName, "tests")

if (!existsSync(testsDir)) {
  console.error(`[test-package] no tests dir: packages/${pkgName}/tests`)
  process.exit(1)
}

const extra = process.argv.slice(2)
const r = spawnSync(
  "pnpm",
  [
    "exec",
    "vitest",
    "run",
    "--config",
    config,
    `packages/${pkgName}/tests`,
    ...extra,
  ],
  { cwd: root, stdio: "inherit", env: process.env },
)

process.exit(r.status ?? 1)
