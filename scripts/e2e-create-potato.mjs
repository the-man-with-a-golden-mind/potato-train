#!/usr/bin/env node
/**
 * E2E: create-potato CLI → install deps → build/run apps
 *
 * Uses the monorepo-built CLI (not npm registry) and rewrites template
 * potato-train-* deps to file: packs of local packages so CI works offline.
 *
 *   node scripts/e2e-create-potato.mjs
 *   PM=pnpm node scripts/e2e-create-potato.mjs
 *   PM=npm SKIP_SSR=1 node scripts/e2e-create-potato.mjs
 *
 * Env:
 *   PM=npm|pnpm|bun     install client (default: pnpm if available else npm)
 *   KEEP=1              leave work dir on disk
 *   SKIP_SPA=1 / SKIP_SSR=1
 *   PORT_BASE=4170      base port for SSR health checks
 */
import { spawnSync, spawn } from "node:child_process"
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  cpSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  realpathSync,
} from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { createServer } from "node:net"
import { setTimeout as sleep } from "node:timers/promises"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const keep = process.env.KEEP === "1"
const skipSpa = process.env.SKIP_SPA === "1"
const skipSsr = process.env.SKIP_SSR === "1"

function log(msg) {
  console.log(`\n▶ ${msg}`)
}

function fail(msg, detail) {
  console.error(`\n✖ ${msg}`)
  if (detail) console.error(detail)
  process.exit(1)
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? root,
    encoding: "utf8",
    env: { ...process.env, ...opts.env },
    stdio: opts.stdio ?? "pipe",
    shell: false,
  })
  if (r.status !== 0 && !opts.allowFail) {
    fail(
      `$ ${cmd} ${args.join(" ")} (cwd=${opts.cwd ?? root})`,
      (r.stdout || "") + (r.stderr || ""),
    )
  }
  return r
}

function detectPm() {
  const pref = process.env.PM
  if (pref === "npm" || pref === "pnpm" || pref === "bun") return pref
  if (run("pnpm", ["-v"], { allowFail: true }).status === 0) return "pnpm"
  if (run("npm", ["-v"], { allowFail: true }).status === 0) return "npm"
  if (run("bun", ["-v"], { allowFail: true }).status === 0) return "bun"
  fail("Need npm, pnpm, or bun on PATH")
}

async function freePort(base = 4170) {
  for (let p = base; p < base + 50; p++) {
    const ok = await new Promise((resolve) => {
      const s = createServer()
      s.once("error", () => resolve(false))
      s.listen(p, "127.0.0.1", () => s.close(() => resolve(true)))
    })
    if (ok) return p
  }
  fail("No free port")
}

async function waitHttp(url, { timeoutMs = 60_000, expect = 200 } = {}) {
  const start = Date.now()
  let last = ""
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      last = `${res.status}`
      if (res.status === expect || (expect === "ok" && res.ok)) return res
    } catch (e) {
      last = e instanceof Error ? e.message : String(e)
    }
    await sleep(400)
  }
  fail(`Timeout waiting for ${url}`, last)
}

function install(pm, cwd) {
  log(`install (${pm}) in ${cwd}`)
  if (pm === "pnpm") {
    // --ignore-workspace: don't walk up into monorepo workspace
    // pnpm may exit non-zero with ERR_PNPM_IGNORED_BUILDS even when deps
    // are installed; onlyBuiltDependencies is set in package.json/.npmrc.
    const r = run(
      "pnpm",
      [
        "install",
        "--ignore-workspace",
        "--config.confirmModulesPurge=false",
        "--config.strict-dep-builds=false",
      ],
      { cwd, stdio: "inherit", allowFail: true },
    )
    if (
      r.status !== 0 &&
      !existsSync(join(cwd, "node_modules", "potato-train-core"))
    ) {
      fail(
        `pnpm install failed and potato-train-core missing`,
        (r.stdout || "") + (r.stderr || ""),
      )
    }
    // Rebuild esbuild if lifecycle scripts were skipped by pnpm policy
    const esbuildInstall = join(
      cwd,
      "node_modules",
      "esbuild",
      "install.js",
    )
    if (existsSync(esbuildInstall)) {
      run(process.execPath, [esbuildInstall], {
        cwd: join(cwd, "node_modules", "esbuild"),
        stdio: "inherit",
        allowFail: true,
      })
    }
  } else if (pm === "bun") {
    run("bun", ["install"], { cwd, stdio: "inherit" })
  } else {
    run("npm", ["install", "--no-fund", "--no-audit"], {
      cwd,
      stdio: "inherit",
    })
  }
}

function rewriteDepsToPacks(appDir, packDir) {
  const pkgPath = join(appDir, "package.json")
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  const tarballs = readdirSync(packDir).filter((f) => f.endsWith(".tgz"))
  const byName = new Map()
  for (const t of tarballs) {
    // potato-train-core-0.2.0.tgz → potato-train-core
    const m = t.match(/^(.+)-(\d+\.\d+\.\d+.*?)\.tgz$/)
    if (m) byName.set(m[1], join(packDir, t))
  }
  for (const field of ["dependencies", "devDependencies"]) {
    const deps = pkg[field]
    if (!deps) continue
    for (const [name, ver] of Object.entries(deps)) {
      if (name.startsWith("potato-train-") || name === "create-potato") {
        const tgz = byName.get(name)
        if (!tgz) {
          fail(`No pack for ${name} (needed by template dep ${ver})`, [
            ...byName.keys(),
          ].join(", "))
        }
        deps[name] = `file:${tgz}`
      }
    }
  }
  // pnpm 10+ may ignore dependency build scripts unless listed
  pkg.pnpm = {
    ...(pkg.pnpm || {}),
    onlyBuiltDependencies: ["esbuild", "@parcel/watcher", "sharp"],
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
  // Avoid parent monorepo workspace discovery; allow esbuild install scripts
  writeFileSync(
    join(appDir, ".npmrc"),
    [
      "ignore-workspace-root-check=true",
      "link-workspace-packages=false",
      "only-built-dependencies[]=esbuild",
      "only-built-dependencies[]=@parcel/watcher",
      "only-built-dependencies[]=sharp",
      "",
    ].join("\n"),
  )
}

/** Rewrite workspace:* → ^version so packed tarballs install outside the monorepo. */
function withRegistryDeps(pkgDir, fn) {
  const pkgPath = join(pkgDir, "package.json")
  const original = readFileSync(pkgPath, "utf8")
  const pkg = JSON.parse(original)
  const ver = pkg.version || "0.2.0"
  for (const field of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const deps = pkg[field]
    if (!deps) continue
    for (const [name, v] of Object.entries(deps)) {
      if (typeof v === "string" && v.startsWith("workspace:")) {
        deps[name] = `^${ver}`
      }
    }
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
  try {
    return fn()
  } finally {
    writeFileSync(pkgPath, original)
  }
}

function packMonorepoPackages(packDir) {
  mkdirSync(packDir, { recursive: true })
  const needed = [
    "core",
    "jsx",
    "html",
    "ssr",
    "live",
    "debug",
    "vite-plugin",
  ]
  for (const dir of needed) {
    const pkgDir = join(root, "packages", dir)
    if (!existsSync(join(pkgDir, "package.json"))) continue
    if (!existsSync(join(pkgDir, "dist"))) {
      fail(`packages/${dir}/dist missing — run pnpm build first`)
    }
    log(`pack packages/${dir}`)
    withRegistryDeps(pkgDir, () => {
      run("npm", ["pack", "--pack-destination", packDir], {
        cwd: pkgDir,
        stdio: "inherit",
      })
    })
  }
}

/**
 * Install create-potato under a fake node_modules path (catches the historic
 * filter bug) and return absolute path to dist/cli.js
 */
function stageCliLikeInstall(work) {
  const installRoot = join(
    work,
    "node_modules",
    ".pnpm",
    "create-potato@local",
    "node_modules",
    "create-potato",
  )
  mkdirSync(installRoot, { recursive: true })
  const src = join(root, "packages", "create-potato")
  cpSync(join(src, "dist"), join(installRoot, "dist"), { recursive: true })
  cpSync(join(src, "templates"), join(installRoot, "templates"), {
    recursive: true,
  })
  // package.json carries "type": "module" — without it Node treats the
  // staged CLI as CommonJS and the top-level `import` throws a SyntaxError.
  cpSync(join(src, "package.json"), join(installRoot, "package.json"))
  const cli = join(installRoot, "dist", "cli.js")
  if (!existsSync(cli)) fail("CLI not staged", cli)
  // Sanity: path must contain node_modules (regression for filter bug)
  if (!cli.includes("node_modules")) {
    fail("Staged CLI path must include node_modules for regression test", cli)
  }
  return cli
}

async function testSpa(cli, work, packDir, pm) {
  log("SPA: scaffold")
  const appDir = join(work, "scaffold-spa")
  run(process.execPath, [cli, "scaffold-spa", "--template=spa"], {
    cwd: work,
    stdio: "inherit",
    env: {
      npm_config_user_agent:
        pm === "pnpm" ? "pnpm/10" : pm === "bun" ? "bun/1" : "npm/10",
    },
  })
  if (!existsSync(join(appDir, "package.json"))) {
    fail("SPA scaffold missing package.json")
  }
  if (!existsSync(join(appDir, "src", "main.tsx"))) {
    fail("SPA scaffold missing src/main.tsx")
  }
  rewriteDepsToPacks(appDir, packDir)
  install(pm, appDir)
  log("SPA: vite build")
  // Invoke vite binary directly — avoids pnpm re-running install/dep checks
  const vite = join(appDir, "node_modules", ".bin", "vite")
  if (!existsSync(vite)) fail("vite binary missing after install")
  run(vite, ["build"], { cwd: appDir, stdio: "inherit" })
  if (!existsSync(join(appDir, "dist", "index.html"))) {
    fail("SPA vite build did not produce dist/index.html")
  }
  console.log("✓ SPA scaffold + install + build")
}

async function testSsr(cli, work, packDir, pm) {
  log("SSR: scaffold")
  const appDir = join(work, "scaffold-ssr")
  run(process.execPath, [cli, "scaffold-ssr", "--template=ssr"], {
    cwd: work,
    stdio: "inherit",
    env: {
      npm_config_user_agent:
        pm === "pnpm" ? "pnpm/10" : pm === "bun" ? "bun/1" : "npm/10",
    },
  })
  if (!existsSync(join(appDir, "src", "server.ts"))) {
    fail("SSR scaffold missing src/server.ts")
  }
  if (!existsSync(join(appDir, "src", "app.tsx"))) {
    fail("SSR scaffold missing src/app.tsx")
  }
  rewriteDepsToPacks(appDir, packDir)
  install(pm, appDir)

  log("SSR: typecheck")
  const tsc = join(appDir, "node_modules", ".bin", "tsc")
  if (!existsSync(tsc)) fail("tsc binary missing after install")
  run(tsc, ["--noEmit"], { cwd: appDir, stdio: "inherit" })

  // CSS optional for boot (server tolerates missing dist/styles.css)
  log("SSR: try css (allow fail if tailwind path issues)")
  const tw = join(appDir, "node_modules", ".bin", "tailwindcss")
  if (existsSync(tw)) {
    run(
      tw,
      ["-i", "./src/styles.css", "-o", "./dist/styles.css", "--minify"],
      { cwd: appDir, stdio: "inherit", allowFail: true },
    )
  }

  const port = await freePort(Number(process.env.PORT_BASE ?? 4170))
  log(`SSR: start server on :${port}`)
  // Prefer local .bin (works for npm / pnpm / bun layouts)
  const tsxBin = join(appDir, "node_modules", ".bin", "tsx")
  const tsxCli = join(appDir, "node_modules", "tsx", "dist", "cli.mjs")
  const useBin = existsSync(tsxBin)
  const child = spawn(
    useBin ? tsxBin : process.execPath,
    useBin
      ? ["--tsconfig", "tsconfig.json", "src/server.ts"]
      : [tsxCli, "--tsconfig", "tsconfig.json", "src/server.ts"],
    {
      cwd: appDir,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
  let logs = ""
  child.stdout?.on("data", (d) => {
    logs += d
  })
  child.stderr?.on("data", (d) => {
    logs += d
  })

  try {
    const health = await waitHttp(`http://127.0.0.1:${port}/api/health`, {
      expect: 200,
      timeoutMs: 45_000,
    })
    const body = await health.json()
    if (!body?.ok) fail("SSR /api/health body", JSON.stringify(body))

    const home = await waitHttp(`http://127.0.0.1:${port}/`, {
      expect: 200,
      timeoutMs: 15_000,
    })
    const html = await home.text()
    if (!html.includes("Potato") && !html.includes("potato") && !html.includes("count")) {
      // still ok if we got HTML document
      if (!html.includes("<!DOCTYPE") && !html.includes("<html")) {
        fail("SSR / did not return HTML", html.slice(0, 400))
      }
    }
    console.log("✓ SSR scaffold + install + typecheck + server health")
  } finally {
    child.kill("SIGTERM")
    await sleep(500)
    try {
      child.kill("SIGKILL")
    } catch {
      /* */
    }
    if (logs && process.env.DEBUG) console.log(logs)
  }
}

async function main() {
  const pm = detectPm()
  console.log(`create-potato e2e · pm=${pm} · root=${root}`)

  log("build monorepo packages")
  run("pnpm", ["build"], { stdio: "inherit" })
  run("pnpm", ["--filter", "create-potato", "build"], { stdio: "inherit" })

  const work = mkdtempSync(join(tmpdir(), "potato-cli-e2e-"))
  const packDir = join(work, "packs")
  console.log(`work=${work}`)

  try {
    packMonorepoPackages(packDir)
    const cli = stageCliLikeInstall(work)
    log(`CLI staged at ${cli}`)

    if (!skipSpa) await testSpa(cli, work, packDir, pm)
    if (!skipSsr) await testSsr(cli, work, packDir, pm)

    console.log("\n✓ create-potato e2e passed (scaffold + install + run)\n")
  } finally {
    if (!keep) {
      rmSync(work, { recursive: true, force: true })
    } else {
      console.log(`KEEP=1 work dir: ${work}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
