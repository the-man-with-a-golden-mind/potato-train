#!/usr/bin/env node
/**
 * Potato release helper.
 *
 * Packages version independently — publish/tag decisions always read each
 * package's own package.json rather than one shared release number.
 *
 * Usage:
 *   node scripts/release.mjs preflight          # build + test
 *   node scripts/release.mjs npm                # publish every package whose version is new
 *   node scripts/release.mjs github [version]   # git tag + gh release
 *   node scripts/release.mjs all [version]      # preflight → npm → github
 *   node scripts/release.mjs build              # build packages only
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

function readVersion(dir) {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version
}

// Packages version independently (e.g. create-potato patches without a
// whole-monorepo bump), so there is no single release VERSION — every
// publish/tag decision reads each package's own package.json live.
const ROOT_VERSION = readVersion(root)

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

/** name → current version, read fresh from each package's own package.json. */
function currentVersionMap() {
  const map = new Map()
  for (const { name, dir } of PUBLISH_ORDER) {
    const pkgDir = join(root, dir)
    if (existsSync(join(pkgDir, "package.json"))) {
      map.set(name, readVersion(pkgDir))
    }
  }
  return map
}

/** Rewrite monorepo `workspace:*` → each dep's real registry version. */
function registryPackageJson(pkg, versionMap) {
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
        const depVersion = versionMap.get(dep)
        if (!depVersion) {
          console.error(
            `No known version for workspace dep "${dep}" (needed by ${pkg.name}). Is it missing from PUBLISH_ORDER?`,
          )
          process.exit(1)
        }
        deps[dep] = `^${depVersion}`
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
function publishFromIsolatedCopy(pkgDir, meta, env, dry, versionMap) {
  const tmp = mkdtempSync(join(tmpdir(), "potato-publish-"))
  try {
    // package.json with registry deps
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify(registryPackageJson(meta, versionMap), null, 2) + "\n",
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

  const versionMap = currentVersionMap()
  const published = []

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

      const pkgVersion = meta.version

      // Skip if this package's own version is already on the registry
      const view = runCapture(
        "npm",
        ["view", `${name}@${pkgVersion}`, "version"],
        { env },
      )
      if (view.status === 0 && view.stdout === pkgVersion) {
        console.log(`\n→ skip ${name}@${pkgVersion} (already on registry)`)
        continue
      }

      console.log(`\n→ publishing ${name}@${pkgVersion} from ${dir}`)
      const { status, out } = publishFromIsolatedCopy(
        pkgDir,
        meta,
        env,
        dry,
        versionMap,
      )
      if (status !== 0) {
        if (/EOTP|one-time password|OTP/i.test(out)) {
          printEotpHelp()
        } else if (/EPUBLISHCONFLICT|cannot publish over/i.test(out)) {
          console.error(
            `\n${name}@${pkgVersion} already exists — bump version or skip.`,
          )
        } else if (/E404|Scope not found/i.test(out)) {
          console.error(`
Scope/name not available. potato-train-* packages are unscoped and should not hit this.
Check package.json "name" field.
`)
        }
        process.exit(status)
      }
      if (!dry) published.push({ name, version: pkgVersion })
    }
    console.log(dry ? "\n✓ Dry-run complete" : "\n✓ npm publish complete")
    if (!dry) {
      if (published.length) {
        console.log("\nPublished:")
        for (const p of published) console.log(`  ${p.name}@${p.version}`)
      } else {
        console.log("\n(nothing new — every package version was already on the registry)")
      }
      console.log("\nVerify:")
      console.log("  npm view potato-train-core version")
      console.log("  npm view create-potato version")
    }
  } finally {
    if (npmrc && existsSync(npmrc)) unlinkSync(npmrc)
  }
  return published
}

function ensureGit(tag) {
  if (!existsSync(join(root, ".git"))) {
    console.log("Initializing git repository…")
    run("git", ["init"])
    run("git", ["add", "-A"])
    const status = runCapture("git", ["status", "--porcelain"])
    if (status.stdout) {
      run("git", [
        "commit",
        "-m",
        `chore: release ${tag}

First public release of Potato — typed Choo-shaped framework.
See CHANGELOG.md.`,
      ])
    }
  } else {
    const status = runCapture("git", ["status", "--porcelain"])
    if (status.stdout) {
      run("git", ["add", "-A"])
      run("git", ["commit", "-m", `chore: prepare ${tag} release`])
    }
  }
}

/**
 * `tagInput` is whatever the caller knows the release is: an explicit
 * version/tag argument, or (from `all`) the single package just published.
 * Falls back to the root package.json version — packages bump independently,
 * so there is no other implicit "the" release version.
 */
function releaseGithub(tagInput) {
  console.log("=== GitHub release ===")
  const version = (tagInput || ROOT_VERSION).replace(/^v/, "")
  const TAG = `v${version}`
  console.log(`Releasing as ${TAG}${tagInput ? "" : ` (root package.json version — pass an explicit version to override, e.g. "node scripts/release.mjs github 0.2.2")`}`)

  ensureGit(TAG)

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
  const versionArg = process.argv[3]
  if (cmd === "preflight") preflight()
  else if (cmd === "build") buildPackages()
  else if (cmd === "npm") publishNpm()
  else if (cmd === "github") releaseGithub(versionArg)
  else if (cmd === "all") {
    preflight()
    const published = publishNpm()
    // A patch release of a single package (the common case here) tags as
    // that package's own version rather than the root's — pass an explicit
    // version argument to force a specific tag either way.
    const inferredTag =
      versionArg || (published.length === 1 ? published[0].version : undefined)
    releaseGithub(inferredTag)
  } else if (cmd === "init-git") {
    ensureGit(`v${ROOT_VERSION}`)
    console.log("Git ready. Add origin and push when ready.")
  } else {
    console.log(`Usage: node scripts/release.mjs <preflight|build|npm|github|all|init-git> [version]

  preflight       install, build, unit tests (+ e2e unless SKIP_E2E=1)
  build           build all publishable packages
  npm             build + publish any package.json version not yet on the registry
  github [version] commit if needed, tag v<version>, push, gh release
                    (version defaults to root package.json; "all" instead
                    defaults to the single package it just published, if any)
  all [version]   preflight → npm → github
  init-git        git init + initial commit only

Examples:
  node scripts/release.mjs npm                # publish every package whose own version is new
  node scripts/release.mjs github 0.2.2        # tag/release v0.2.2 explicitly
  node scripts/release.mjs all                 # publish create-potato@0.2.2 alone, tag v0.2.2 automatically

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
