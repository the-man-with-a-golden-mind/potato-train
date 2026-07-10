# Release guide (npm + GitHub)

Ship Potato **0.2.0** with the release script.

## Prerequisites

| Tool | Why |
|------|-----|
| Node **20+** (22.13+ or 24 for current pnpm) | Runtime |
| **NPM_TOKEN** (recommended) or `npm login` + OTP | Publish to registry.npmjs.org |
| Built `packages/*/dist` | Release script builds automatically |
| **git** + **origin** remote | Tag and push |
| **GitHub CLI** (`gh`) | Create GitHub Release (optional) |

### Auth (required — account has 2FA on writes)

Your npm profile is **auth-and-writes**. A normal `npm login` token **cannot** publish without a fresh 6-digit OTP every time.

**Permanent fix — Automation / bypass-2FA token:**

1. Open [npm Access Tokens](https://www.npmjs.com/settings/~/tokens)
2. **Generate New Token** → **Granular Access Token**
3. Token name: `potato-train-publish`
4. Expiration: 90 days (or custom)
5. Permissions: **Read and write**
6. Enable **Bypass two-factor authentication**
7. Packages: allow publish (or “All packages” if available)
8. Generate and copy `npm_…`

```bash
export NPM_TOKEN=npm_xxxxxxxxxxxxxxxx
cd /path/to/potato-train
node scripts/release.mjs npm
```

**One-shot with authenticator (expires ~30s):**

```bash
NPM_OTP=123456 node scripts/release.mjs npm
```

### Do not publish these

| Path | Why |
|------|-----|
| Repo root (`potato-train`) | `"private": true` monorepo |
| `packages/potato` | `"private": true` — unscoped name `potato` is **taken on npm** |

Publish **`potato-train-*`** and **`create-potato`** only.

## Publish (recommended)

```bash
nvm use 24   # or Node ≥ 22.13
cd potato-train
pnpm install

# Dry-run
DRY_RUN=1 node scripts/release.mjs npm

# Real publish (builds dist, rewrites workspace:* → ^0.2.0, npm publish each package)
export NPM_TOKEN=npm_...   # automation token
node scripts/release.mjs npm
```

Or:

```bash
pnpm release:npm
```

### One package by hand

```bash
cd packages/core
# workspace deps must be rewritten — prefer release.mjs instead
npm publish --access public --otp=123456
```

**Do not** run `npm publish` from the monorepo root or from `packages/potato`.

## Publish order

```text
potato-train-core
  → jsx, html, virtual, formula, debug, vite-plugin
  → ssr → live, auth, db → cloudflare
create-potato
```

(`potato` meta package is skipped — private.)

## Full monorepo release

```bash
pnpm release              # preflight + npm + github
# or
SKIP_E2E=1 pnpm release:preflight
pnpm release:npm
pnpm release:github
```

## Verify

```bash
npm view potato-train-core version
npm view create-potato version
pnpm create potato /tmp/potato-smoke -- --template=ssr
# also: npm create potato@latest /tmp/potato-smoke-npm -- --ssr
# also: bun create potato /tmp/potato-smoke-bun --template=ssr
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `EPRIVATE` | You published the **root** or **`packages/potato`**. Use `node scripts/release.mjs npm`. |
| `ENEEDAUTH` | `export NPM_TOKEN=…` or `npm login` |
| `EOTP` | Use an **Automation / bypass-2FA** token, or `NPM_OTP=123456` (6 digits from authenticator) |
| `EPUBLISHCONFLICT` | Version already on registry — bump versions |
| `E404 Scope not found` | Do **not** use `@potato/*` or `@potato-train/*` without an npm org. Use unscoped `potato-train-*`. |
| Empty package on npm | Build first (`node scripts/release.mjs build`) so `dist/` exists |
| `workspace:*` in tarball | Always publish via `scripts/release.mjs` (rewrites deps) |
| `gh: command not found` | Install CLI or create release in GitHub UI |
| No `origin` | `git remote add origin …` then push |
