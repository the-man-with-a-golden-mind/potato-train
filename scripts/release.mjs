#!/usr/bin/env node
/**
 * Potato 0.2.0 release helper
 *
 * Usage:
 *   node scripts/release.mjs preflight   # build + test
 *   node scripts/release.mjs npm         # publish to npm
 *   node scripts/release.mjs github      # git tag + gh release
 *   node scripts/release.mjs all         # preflight → npm → github
 *   node scripts/release.mjs build       # build packages only
 *
 * Auth (pick one — Automation token is best with 2FA):
 *   NPM_TOKEN=npm_...   # Granular token with "Bypass 2FA" / Automation
 *   npm login           # interactive; still needs NPM_OTP if 2FA is auth-and-writes
 *   NPM_OTP=123456      # authenticator code (6 digits, ~30s lifetime)
 *
 * Other env:
 *   DRY_RUN=1   — npm publish --dry-run
 *   SKIP_E2E=1  — skip Playwright in preflight
 *   SKIP_BUILD=1 — skip build before npm publish
 */
import { spawnSync } from "node:child_process"
import {
  existsSync,
  writeFileSync,
  unlinkSync,
  readFileSync,
  mkdirSync,
  cpSync,
  rmSync,
  mkdtempSync,
} from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir, homedir } from "node:os"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const VERSION = "0.2.0"
const TAG = `v${VERSION}`

/**
 * Publish order (deps first).
 * Never publish: root (private), packages/potato (private — unscoped name taken).
 */
const PUBLISH_ORDER = [
  { name: "potato-train-core", dir: "packages/core" },
  { name: "potato-train-jsx", dir: "packages/jsx" },
  { name: "potato-train-html", dir: "packages/html" },
  { name: "potato-train-virtual", dir: "packages/virtual" },
  { name: "potato-train-formula", dir: "packages/formula" },
  { name: "potato-train-debug", dir: "packages/debug" },
  { name: "potato-train-vite-plugin", dir: "packages/vite-plugin" },
  { name: "potato-train-ssr", dir: "packages/ssr" },
  { name: "potato-train-live", dir: "packages/live" },
  { name: "potato-train-auth", dir: "packages/auth" },
  { name: "potato-train-db", dir: "packages/db" },
  { name: "potato-train-cloudflare", dir: "packages/cloudflare" },
  { name: "create-potato", dir: "packages/create-potato" },
]

/** Rewrite monorepo `workspace:*` → registry version so npm tarballs are valid. */
function registryPackageJson(pkg) {
  const next = structuredClone(pkg)
  for (const field of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const deps = next[field]
    if (!deps) continue
    for (const [dep, ver] of Object.entries(deps)) {
      if (typeof ver === "string" && ver.startsWith("workspace:")) {
        deps[dep] = `^${VERSION}`
      }
    }
  }
  // Strip monorepo-only scripts that break on registry consumers
  if (next.scripts) {
    delete next.scripts.prepublishOnly
  }
  return next
}

/**
 * Publish from an isolated temp directory so monorepo workspaces / .npmrc
 * cannot interfere with `npm publish`.
 */
function publishFromIsolatedCopy(pkgDir, meta, env, dry) {
  const tmp = mkdtempSync(join(tmpdir(), "potato-publish-"))
  try {
    // package.json with registry deps
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify(registryPackageJson(meta), null, 2) + "\n",
    )
    // ship only what "files" declares (default dist + common bits)
    const files = meta.files || ["dist"]
    for (const f of files) {
      const src = join(pkgDir, f)
      if (!existsSync(src)) {
        console.error(`Missing ${src} (listed in package.json files)`)
        process.exit(1)
      }
      cpSync(src, join(tmp, f), { recursive: true })
    }
    // ensure bin scripts are executable
    if (meta.bin) {
      const bins = typeof meta.bin === "string" ? [meta.bin] : Object.values(meta.bin)
      for (const b of bins) {
        const binPath = join(tmp, b)
        if (existsSync(binPath)) {
          try {
            spawnSync("chmod", ["+x", binPath], { shell: false })
          } catch {
            /* ignore */
          }
        }
      }
    }
    // optional root files often expected
    for (const extra of ["README.md", "LICENSE", "license"]) {
      const src = join(pkgDir, extra)
      if (existsSync(src)) cpSync(src, join(tmp, extra))
    }
    // monorepo root LICENSE
    if (!existsSync(join(tmp, "LICENSE")) && existsSync(join(root, "LICENSE"))) {
      cpSync(join(root, "LICENSE"), join(tmp, "LICENSE"))
    }

    const args = [
      "publish",
      "--access",
      "public",
      "--registry",
      "https://registry.npmjs.org/",
    ]
    if (dry) args.push("--dry-run")
    if (process.env.NPM_OTP) args.push("--otp", process.env.NPM_OTP)

    const r = spawnSync("npm", args, {
      cwd: tmp,
      stdio: "pipe",
      encoding: "utf8",
      env: { ...process.env, ...env },
      shell: false,
    })
    process.stdout.write(r.stdout || "")
    process.stderr.write(r.stderr || "")
    return { status: r.status ?? 1, out: `${r.stdout || ""}${r.stderr || ""}` }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`)
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || root,
    stdio: "inherit",
    env: { ...process.env, ...opts.env },
    shell: false,
  })
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
}

function resolvePnpm() {
  const execPath = process.env.npm_execpath || ""
  if (execPath.includes("pnpm")) {
    return { cmd: process.execPath, args: [execPath], display: "pnpm" }
  }
  return { cmd: "pnpm", args: [], display: "pnpm" }
}

const pnpmEnv = {
  CI: process.env.CI || "true",
  PATH: `${dirname(process.execPath)}:${process.env.PATH || ""}`,
  pnpm_config_auto_install_peers: "false",
  pnpm_config_strict_peer_dependencies: "false",
  pnpm_config_confirm_modules_purge: "false",
  npm_config_auto_install_peers: "false",
  npm_config_strict_peer_dependencies: "false",
  npm_config_confirm_modules_purge: "false",
  NPM_CONFIG_AUTO_INSTALL_PEERS: "false",
  NPM_CONFIG_STRICT_PEER_DEPENDENCIES: "false",
  NPM_CONFIG_CONFIRM_MODULES_PURGE: "false",
  pnpm_config_pm_on_fail: "ignore",
}

const nodePathEnv = {
  PATH: `${dirname(process.execPath)}:${process.env.PATH || ""}`,
}

function runPnpm(args, opts = {}) {
  const pnpm = resolvePnpm()
  console.log(`\n$ ${pnpm.display} ${args.join(" ")}`)
  const r = spawnSync(pnpm.cmd, [...pnpm.args, ...args], {
    cwd: opts.cwd || root,
    stdio: "inherit",
    env: { ...process.env, ...pnpmEnv, ...opts.env },
    shell: false,
  })
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
}

function runCapture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || root,
    encoding: "utf8",
    shell: false,
    env: { ...process.env, ...opts.env },
  })
  return {
    status: r.status ?? 1,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
  }
}

function capturePnpm(args, opts = {}) {
  const pnpm = resolvePnpm()
  const r = spawnSync(pnpm.cmd, [...pnpm.args, ...args], {
    cwd: opts.cwd || root,
    encoding: "utf8",
    shell: false,
    env: { ...process.env, ...pnpmEnv, ...opts.env },
  })
  return {
    status: r.status ?? 1,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
  }
}

function buildPackages() {
  console.log("=== Build packages ===")
  // Prefer pnpm when available; fall back to per-package npm run build
  const pnpm = capturePnpm(["-v"])
  if (pnpm.status === 0) {
    runPnpm(["install"])
    runPnpm(["build"])
    runPnpm(["--filter", "create-potato", "build"])
  } else {
    console.log("pnpm not found — building packages with npm run build")
    for (const { dir } of PUBLISH_ORDER) {
      const pkgDir = join(root, dir)
      if (!existsSync(join(pkgDir, "package.json"))) continue
      run("npm", ["run", "build"], { cwd: pkgDir })
    }
  }
  // Verify dist
  for (const { name, dir } of PUBLISH_ORDER) {
    const dist = join(root, dir, "dist")
    if (!existsSync(dist)) {
      console.error(`Missing ${dist} for ${name} — build failed`)
      process.exit(1)
    }
  }
  console.log("\n✓ Build OK")
}

function preflight() {
  console.log("=== Preflight ===")
  buildPackages()
  runPnpm(["test"])
  if (process.env.SKIP_E2E !== "1") {
    console.log("(e2e — set SKIP_E2E=1 to skip)")
    runPnpm(["exec", "playwright", "test"])
  } else {
    console.log("SKIP_E2E=1 — skipped Playwright")
  }
  console.log("\n✓ Preflight OK")
}

/** Read auth token from env or ~/.npmrc (never logs the token). */
function readAuthToken() {
  if (process.env.NPM_TOKEN) return process.env.NPM_TOKEN.trim()
  const npmrcPath = join(homedir(), ".npmrc")
  if (!existsSync(npmrcPath)) return null
  const text = readFileSync(npmrcPath, "utf8")
  const m = text.match(/\/\/registry\.npmjs\.org\/:_authToken=(.+)/)
  return m ? m[1].trim() : null
}

/**
 * Isolated userconfig for publish so monorepo .npmrc knobs don't interfere.
 * Returns path to temp npmrc, or null.
 */
function ensureNpmAuth() {
  const token = readAuthToken()
  if (!token) {
    console.error(`
Not logged in to npm and NPM_TOKEN is not set.

Recommended (works with 2FA auth-and-writes):
  1. https://www.npmjs.com/settings/~/tokens → Generate New Token
  2. Type: Granular Access Token
  3. Permissions: Read and write
  4. ✅ Bypass two-factor authentication (or use "Automation" classic token)
  5. Packages: select all potato-train-* (or "All packages" if allowed)

  export NPM_TOKEN=npm_...
  node scripts/release.mjs npm

Or interactive login (still needs a 6-digit OTP each publish if 2FA is on):
  npm login
  NPM_OTP=123456 node scripts/release.mjs npm
`)
    process.exit(1)
  }

  const npmrc = join(root, ".npmrc.release")
  // Clean config: only auth + public access. No monorepo workspace noise.
  writeFileSync(
    npmrc,
    [
      `//registry.npmjs.org/:_authToken=${token}`,
      "registry=https://registry.npmjs.org/",
      "access=public",
      "",
    ].join("\n"),
  )

  const who = runCapture("npm", ["whoami"], {
    env: {
      ...nodePathEnv,
      npm_config_userconfig: npmrc,
      NPM_CONFIG_USERCONFIG: npmrc,
    },
  })
  if (who.status !== 0) {
    console.error("npm whoami failed with provided token. Check NPM_TOKEN / npm login.")
    if (existsSync(npmrc)) unlinkSync(npmrc)
    process.exit(1)
  }
  console.log(`npm user: ${who.stdout}`)
  if (!process.env.NPM_TOKEN) {
    console.log(
      "(using ~/.npmrc token — if publish fails with EOTP, create an Automation/bypass-2FA token)",
    )
  }
  return npmrc
}

function printEotpHelp() {
  console.error(`
────────────────────────────────────────────────────────────
npm rejected publish: 2FA required (EOTP)

Your account has "auth-and-writes". A normal login token needs a
fresh 6-digit authenticator code on every publish.

Permanent fix (recommended):
  1. Open https://www.npmjs.com/settings/~/tokens
  2. Generate New Token → Granular Access Token
  3. Enable "Bypass two-factor authentication"
  4. Permission: Read and write; allow publish
  5. Then:

     export NPM_TOKEN=npm_xxxxxxxx
     node scripts/release.mjs npm

One-shot with authenticator (code expires ~30s):

     NPM_OTP=123456 node scripts/release.mjs npm
────────────────────────────────────────────────────────────
`)
}

function publishNpm() {
  console.log("=== npm publish ===")
  console.log(
    "Skipping private packages: monorepo root, packages/potato (name taken).",
  )
  console.log("Publishing unscoped potato-train-* + create-potato (no org needed).")

  if (process.env.SKIP_BUILD !== "1") {
    buildPackages()
  }

  const npmrc = ensureNpmAuth()
  const dry = process.env.DRY_RUN === "1"
  // Isolated userconfig only — do not set workspaces flags (npm errors if both are set).
  const env = {
    ...nodePathEnv,
    npm_config_userconfig: npmrc,
    NPM_CONFIG_USERCONFIG: npmrc,
  }

  try {
    for (const { name, dir } of PUBLISH_ORDER) {
      const pkgDir = join(root, dir)
      const pkgJsonPath = join(pkgDir, "package.json")
      if (!existsSync(pkgJsonPath)) {
        console.error(`Missing ${pkgJsonPath}`)
        process.exit(1)
      }
      const meta = JSON.parse(readFileSync(pkgJsonPath, "utf8"))
      if (meta.private) {
        console.log(`\n→ skip ${name} (private: true)`)
        continue
      }
      if (!existsSync(join(pkgDir, "dist"))) {
        console.error(`\n→ ${name}: dist/ missing — run build first`)
        process.exit(1)
      }

      // Skip if version already on registry
      const view = runCapture("npm", ["view", `${name}@${VERSION}`, "version"], {
        env,
      })
      if (view.status === 0 && view.stdout === VERSION) {
        console.log(`\n→ skip ${name}@${VERSION} (already on registry)`)
        continue
      }

      console.log(`\n→ publishing ${name}@${VERSION} from ${dir}`)
      const { status, out } = publishFromIsolatedCopy(pkgDir, meta, env, dry)
      if (status !== 0) {
        if (/EOTP|one-time password|OTP/i.test(out)) {
          printEotpHelp()
        } else if (/EPUBLISHCONFLICT|cannot publish over/i.test(out)) {
          console.error(
            `\n${name}@${VERSION} already exists — bump version or skip.`,
          )
        } else if (/E404|Scope not found/i.test(out)) {
          console.error(`
Scope/name not available. potato-train-* packages are unscoped and should not hit this.
Check package.json "name" field.
`)
        }
        process.exit(status)
      }
    }
    console.log(dry ? "\n✓ Dry-run complete" : "\n✓ npm publish complete")
    if (!dry) {
      console.log("\nVerify:")
      console.log("  npm view potato-train-core version")
      console.log("  npm view create-potato version")
    }
  } finally {
    if (npmrc && existsSync(npmrc)) unlinkSync(npmrc)
  }
}

function ensureGit() {
  if (!existsSync(join(root, ".git"))) {
    console.log("Initializing git repository…")
    run("git", ["init"])
    run("git", ["add", "-A"])
    const status = runCapture("git", ["status", "--porcelain"])
    if (status.stdout) {
      run("git", [
        "commit",
        "-m",
        `chore: release ${TAG}

First public release of Potato — typed Choo-shaped framework.
See CHANGELOG.md.`,
      ])
    }
  } else {
    const status = runCapture("git", ["status", "--porcelain"])
    if (status.stdout) {
      run("git", ["add", "-A"])
      run("git", ["commit", "-m", `chore: prepare ${TAG} release`])
    }
  }
}

function releaseGithub() {
  console.log("=== GitHub release ===")
  ensureGit()

  const remote = runCapture("git", ["remote", "get-url", "origin"])
  if (remote.status !== 0) {
    console.error(`
No git remote "origin".

  git remote add origin git@github.com:YOUR_USER/potato-train.git
  git push -u origin HEAD

Then re-run: node scripts/release.mjs github
`)
    process.exit(1)
  }
  console.log(`origin: ${remote.stdout}`)

  const tags = runCapture("git", ["tag", "-l", TAG])
  if (!tags.stdout.includes(TAG)) {
    run("git", ["tag", "-a", TAG, "-m", `Potato ${TAG}`])
  } else {
    console.log(`tag ${TAG} already exists`)
  }

  run("git", ["push", "origin", "HEAD"])
  run("git", ["push", "origin", TAG])

  const gh = runCapture("gh", ["--version"])
  if (gh.status !== 0) {
    console.error(`
git tag ${TAG} pushed, but GitHub CLI (gh) is not installed.
Create the release in the GitHub UI from tag ${TAG}.
`)
    process.exit(1)
  }

  const notes = join(root, "docs/github-release-notes.md")
  run("gh", [
    "release",
    "create",
    TAG,
    "--title",
    `Potato ${TAG}`,
    "--notes-file",
    notes,
    "--latest",
  ])
  console.log("\n✓ GitHub release created")
}

function main() {
  const cmd = process.argv[2] || "help"
  if (cmd === "preflight") preflight()
  else if (cmd === "build") buildPackages()
  else if (cmd === "npm") publishNpm()
  else if (cmd === "github") releaseGithub()
  else if (cmd === "all") {
    preflight()
    publishNpm()
    releaseGithub()
  } else if (cmd === "init-git") {
    ensureGit()
    console.log("Git ready. Add origin and push when ready.")
  } else {
    console.log(`Usage: node scripts/release.mjs <preflight|build|npm|github|all|init-git>

  preflight  install, build, unit tests (+ e2e unless SKIP_E2E=1)
  build      build all publishable packages
  npm        build + publish potato-train-* to registry.npmjs.org
  github     commit if needed, tag ${TAG}, push, gh release
  all        preflight → npm → github
  init-git   git init + initial commit only

Auth:
  NPM_TOKEN=npm_...   Automation / bypass-2FA token (best)
  NPM_OTP=123456      6-digit authenticator code
  DRY_RUN=1           dry-run publish
  SKIP_BUILD=1        skip build before publish
  SKIP_E2E=1          skip Playwright in preflight
`)
  }
}

main()
