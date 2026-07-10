/**
 * create-potato integration tests.
 * Simulates a real npm/pnpm install path under node_modules (the historical bug).
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest"
import { spawnSync } from "node:child_process"
import {
  mkdtempSync,
  cpSync,
  rmSync,
  existsSync,
  readFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"

const pkgRoot = join(fileURLToPath(import.meta.url), "../..")
const monorepoRoot = join(pkgRoot, "../..")

describe("create-potato scaffold", () => {
  let work: string
  let fakeInstall: string
  let cli: string

  beforeAll(() => {
    // Build CLI
    const build = spawnSync("pnpm", ["build"], {
      cwd: pkgRoot,
      encoding: "utf8",
      shell: false,
    })
    if (build.status !== 0) {
      throw new Error(`build failed: ${build.stderr || build.stdout}`)
    }

    work = mkdtempSync(join(tmpdir(), "create-potato-test-"))
    // Simulate: …/node_modules/create-potato/{dist,templates}
    fakeInstall = join(
      work,
      "node_modules",
      ".pnpm",
      "create-potato@0.2.1",
      "node_modules",
      "create-potato",
    )
    mkdirSync(fakeInstall, { recursive: true })
    cpSync(join(pkgRoot, "dist"), join(fakeInstall, "dist"), {
      recursive: true,
    })
    cpSync(join(pkgRoot, "templates"), join(fakeInstall, "templates"), {
      recursive: true,
    })
    cli = join(fakeInstall, "dist", "cli.js")
    expect(existsSync(cli)).toBe(true)
    expect(existsSync(join(fakeInstall, "templates", "ssr"))).toBe(true)
  })

  afterAll(() => {
    if (work) rmSync(work, { recursive: true, force: true })
  })

  function runCli(args: string[], cwd: string) {
    return spawnSync(process.execPath, [cli, ...args], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, npm_config_user_agent: "pnpm/10" },
    })
  }

  it("copies ssr template from a node_modules path (pnpm layout)", () => {
    const cwd = mkdtempSync(join(work, "ssr-"))
    const r = runCli(["demo-ssr", "--template=ssr"], cwd)
    expect(r.status, r.stderr || r.stdout).toBe(0)
    const app = join(cwd, "demo-ssr")
    expect(existsSync(join(app, "package.json"))).toBe(true)
    expect(existsSync(join(app, "src", "server.ts"))).toBe(true)
    expect(existsSync(join(app, "src", "app.tsx"))).toBe(true)
    const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8"))
    expect(pkg.name).toBe("demo-ssr")
    // portable scripts (not pnpm-only)
    expect(String(pkg.scripts.dev)).toContain("npm run css")
    expect(readdirSync(app)).toContain("README.md")
  })

  it("copies spa template with --spa", () => {
    const cwd = mkdtempSync(join(work, "spa-"))
    const r = runCli(["demo-spa", "--spa"], cwd)
    expect(r.status, r.stderr || r.stdout).toBe(0)
    const app = join(cwd, "demo-spa")
    expect(existsSync(join(app, "vite.config.ts"))).toBe(true)
    expect(existsSync(join(app, "src", "main.tsx"))).toBe(true)
  })

  it("accepts --template ssr (space form)", () => {
    const cwd = mkdtempSync(join(work, "ssr2-"))
    const r = runCli(["demo-ssr2", "--template", "ssr"], cwd)
    expect(r.status, r.stderr || r.stdout).toBe(0)
    expect(existsSync(join(cwd, "demo-ssr2", "src", "server.ts"))).toBe(true)
  })

  it("rejects unknown template", () => {
    const cwd = mkdtempSync(join(work, "bad-"))
    const r = runCli(["x", "--template=nope"], cwd)
    expect(r.status).not.toBe(0)
    expect(r.stderr + r.stdout).toMatch(/Unknown template/)
  })
})
