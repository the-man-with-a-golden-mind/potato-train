#!/usr/bin/env node
/**
 * Potato 0.1.0 release helper
 *
 * Usage:
 *   node scripts/release.mjs preflight   # build + test
 *   node scripts/release.mjs npm         # publish to npm (needs npm login)
 *   node scripts/release.mjs github      # git tag + gh release (needs git remote + gh)
 *   node scripts/release.mjs all         # preflight → npm → github
 *
 * Env:
 *   NPM_TOKEN   — optional; written to temp .npmrc for CI
 *   GITHUB_TOKEN / GH_TOKEN — for gh release
 *   SKIP_E2E=1  — skip Playwright in preflight
 *   DRY_RUN=1   — npm publish --dry-run
 */
import { spawnSync } from "node:child_process"
import { existsSync, writeFileSync, unlinkSync, readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const VERSION = "0.1.0"
const TAG = `v${VERSION}`

/** Publish order (deps first). Unscoped `potato` is private (name taken on npm). */
const PUBLISH_ORDER = [
  "@potato/core",
  "@potato/jsx",
  "@potato/html",
  "@potato/virtual",
  "@potato/formula",
  "@potato/debug",
  "@potato/vite-plugin",
  "@potato/ssr",
  "@potato/live",
  "@potato/auth",
  "@potato/db",
  "@potato/cloudflare",
  "create-potato",
]

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`)
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...opts.env },
    shell: false,
  })
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
}

function runCapture(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  })
  return {
    status: r.status ?? 1,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
  }
}

function preflight() {
  console.log("=== Preflight ===")
  run("pnpm", ["install"])
  run("pnpm", ["build"])
  run("pnpm", ["--filter", "create-potato", "build"])
  run("pnpm", ["test"])
  if (process.env.SKIP_E2E !== "1") {
    console.log("(e2e — set SKIP_E2E=1 to skip)")
    run("pnpm", ["exec", "playwright", "test"])
  } else {
    console.log("SKIP_E2E=1 — skipped Playwright")
  }
  console.log("\n✓ Preflight OK")
}

function ensureNpmAuth() {
  if (process.env.NPM_TOKEN) {
    const npmrc = join(root, ".npmrc.release")
    writeFileSync(
      npmrc,
      `//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}\naccess=public\n`,
    )
    return npmrc
  }
  const who = runCapture("npm", ["whoami"])
  if (who.status !== 0) {
    console.error(`
Not logged in to npm.

  npm login
  # or: export NPM_TOKEN=npm_...

Then re-run: node scripts/release.mjs npm
`)
    process.exit(1)
  }
  console.log(`npm user: ${who.stdout}`)
  return null
}

function publishNpm() {
  console.log("=== npm publish ===")
  const npmrc = ensureNpmAuth()
  const dry = process.env.DRY_RUN === "1"
  const env = npmrc
    ? { npm_config_userconfig: npmrc, NPM_CONFIG_USERCONFIG: npmrc }
    : {}

  try {
    for (const name of PUBLISH_ORDER) {
      console.log(`\n→ publishing ${name}@${VERSION}`)
      const args = [
        "--filter",
        name,
        "publish",
        "--access",
        "public",
        "--no-git-checks",
      ]
      if (dry) args.push("--dry-run")
      // pnpm publish rewrites workspace:* for the registry
      run("pnpm", args, { env })
    }
    console.log(dry ? "\n✓ Dry-run complete" : "\n✓ npm publish complete")
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
    // commit pending if any
    const status = runCapture("git", ["status", "--porcelain"])
    if (status.stdout) {
      run("git", ["add", "-A"])
      run("git", [
        "commit",
        "-m",
        `chore: prepare ${TAG} release`,
      ])
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

  # Create a GitHub repo, then:
  git remote add origin git@github.com:YOUR_USER/potato-train.git
  git push -u origin HEAD

  # Install GitHub CLI if needed:
  #   https://cli.github.com/

Then re-run: node scripts/release.mjs github
`)
    process.exit(1)
  }
  console.log(`origin: ${remote.stdout}`)

  // tag
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

  # Install: https://cli.github.com/
  # Then create the release:
  gh release create ${TAG} --title "Potato ${TAG}" --notes-file docs/github-release-notes.md

Or create the release in the GitHub UI from tag ${TAG}.
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
    console.log(`Usage: node scripts/release.mjs <preflight|npm|github|all|init-git>

  preflight  install, build, unit tests (+ e2e unless SKIP_E2E=1)
  npm        publish packages to registry.npmjs.org
  github     commit if needed, tag ${TAG}, push, gh release
  all        preflight → npm → github
  init-git   git init + initial commit only

Env: NPM_TOKEN, GH_TOKEN/GITHUB_TOKEN, SKIP_E2E=1, DRY_RUN=1
`)
  }
}

main()
