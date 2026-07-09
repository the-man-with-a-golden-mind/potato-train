# Release guide (npm + GitHub)

Ship Potato **0.1.0** with the release script.

## Prerequisites

| Tool | Why |
|------|-----|
| Node 20+, pnpm | Build / test / publish |
| **npm login** (or `NPM_TOKEN`) | Publish to registry.npmjs.org |
| **git** + **origin** remote | Tag and push |
| **GitHub CLI** (`gh`) | Create GitHub Release (optional if you use the UI) |

```bash
npm whoami          # must print your npm username
gh auth status      # must be logged in for gh release
```

### Important: unscoped name `potato` is taken

The monorepo meta package `packages/potato` is **`private: true`** and is **not** published.  
Consumers install **`@potato/core`**, `@potato/jsx`, etc., or use **`create-potato`**.

## One-shot (when authenticated)

```bash
cd potato-train
pnpm install

# Full: tests + e2e + npm publish + git tag + GitHub release
pnpm release

# Or step by step:
pnpm release:preflight          # install, build, unit tests (+ e2e)
SKIP_E2E=1 pnpm release:preflight   # faster
DRY_RUN=1 pnpm release:npm      # dry-run publish
pnpm release:npm                # real publish
pnpm release:github             # tag v0.1.0 + gh release
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
| `ENEEDAUTH` | `npm login` or `export NPM_TOKEN=…` |
| `403` on `@potato/*` | Create org/user scope on npm; you must own `@potato` |
| `EPUBLISHCONFLICT` | Version already exists — bump versions in all packages |
| `gh: command not found` | Install CLI or create release in UI from tag |
| No `origin` | `git remote add origin …` then push |
