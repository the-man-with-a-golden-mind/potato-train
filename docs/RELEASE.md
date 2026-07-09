# Release guide (npm + GitHub)

Ship Potato **0.1.0** with the release script.

## Prerequisites

| Tool | Why |
|------|-----|
| Node 20+ | Runtime |
| **npm login** (or `NPM_TOKEN`) | Publish to registry.npmjs.org |
| Built `packages/*/dist` | Publish tarballs need built output |
| **git** + **origin** remote | Tag and push |
| **GitHub CLI** (`gh`) | Create GitHub Release (optional if you use the UI) |

```bash
npm whoami          # must print your npm username
gh auth status      # must be logged in for gh release
```

### Important: do not publish private packages

| Path | Why `EPRIVATE` |
|------|----------------|
| Repo root (`potato-train`) | `"private": true` monorepo |
| `packages/potato` | `"private": true` — unscoped name `potato` is **taken on npm** |

Publish **`@potato/*`** and **`create-potato`** only. Consumers install those — not unscoped `potato`.

## Publish with npm only (no pnpm)

```bash
cd potato-train
npm login

# Ensure packages are built first (however you build: pnpm/bun/npx tsup)
# then:

# Dry-run
DRY_RUN=1 node scripts/release.mjs npm

# Real publish (uses `npm publish --access public` in each package dir;
# rewrites workspace:* → ^0.1.0 for the registry)
node scripts/release.mjs npm
```

Or one package by hand (from that package directory, after rewriting workspace deps if any):

```bash
cd packages/core
npm publish --access public
```

**Do not** run `npm publish` from the monorepo root or from `packages/potato` — that is the `EPRIVATE` error.

## One-shot with monorepo scripts (optional; needs pnpm for install/build)

```bash
cd potato-train
pnpm install

# Full: tests + e2e + npm publish + git tag + GitHub release
pnpm release

# Or step by step:
pnpm release:preflight
DRY_RUN=1 pnpm release:npm   # still publishes via npm under the hood
pnpm release:npm
pnpm release:github
```

## Publish order (handled by the script)

```text
@potato/core
  → jsx, html, virtual, formula, debug, vite-plugin
  → ssr → live, auth, db → cloudflare
create-potato
```

(`potato` meta package is skipped — private.)

## First-time git / GitHub setup

This repo may start without `.git`. The script can init:

```bash
node scripts/release.mjs init-git

# Create empty repo on GitHub, then:
git remote add origin git@github.com:YOUR_USER/potato-train.git
git branch -M main
git push -u origin main

# Install gh: https://cli.github.com/
gh auth login
```

Then:

```bash
pnpm release:github
```

Or create the release in the GitHub UI from tag `v0.1.0` using notes in `docs/github-release-notes.md`.

## After npm publish — set repository fields

Once the GitHub URL is final, add to each public package (optional but nice):

```json
"repository": {
  "type": "git",
  "url": "https://github.com/YOUR_USER/potato-train.git",
  "directory": "packages/core"
}
```

Script helper after remote exists:

```bash
# optional: node scripts/set-repo-urls.mjs https://github.com/YOU/potato-train
```

## Verify

```bash
npm view @potato/core version
npm view create-potato version
pnpm create potato /tmp/potato-smoke
```

## Not published

| Item | Why |
|------|-----|
| `examples/*` | Demos only |
| `eval/*` | Agent benchmarks |
| Root `potato-train` package | Private monorepo root |
| Unscoped `potato` | Name taken on npm; package is private |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `EPRIVATE` | You published the **root** or **`packages/potato`**. Use `node scripts/release.mjs npm` instead. |
| `ENEEDAUTH` | `npm login` or `export NPM_TOKEN=…` |
| `403` on `@potato/*` | Create org **potato** on npmjs.com (public packages are free); you must own `@potato` |
| `EPUBLISHCONFLICT` | Version already exists — bump versions in all packages |
| `gh: command not found` | Install CLI or create release in UI from tag |
| No `origin` | `git remote add origin …` then push |
