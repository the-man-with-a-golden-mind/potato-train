#!/usr/bin/env node
/**
 * create-potato — scaffold apps on the product architecture:
 *   createApp + State + Events + defineFeature + patch
 *
 * Works with npm / pnpm / bun create:
 *   npm create potato@latest my-app -- --template=ssr
 *   pnpm create potato my-app -- --template=ssr
 *   bun create potato my-app --template=ssr
 */
import {
  mkdir,
  writeFile,
  cp,
  access,
  readFile,
  readdir,
  stat,
} from "node:fs/promises"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const templates = ["spa", "ssr"] as const
type Template = (typeof templates)[number]
type PackageManager = "npm" | "pnpm" | "bun" | "yarn"

/**
 * Skip nested junk *inside* the template tree.
 * Basename only — absolute install paths always contain `node_modules`.
 */
function shouldCopy(src: string): boolean {
  const base = basename(src)
  return base !== "node_modules" && base !== "dist" && base !== ".git"
}

function detectPackageManager(forced?: string): PackageManager {
  if (forced === "npm" || forced === "pnpm" || forced === "bun" || forced === "yarn") {
    return forced
  }
  const ua = process.env.npm_config_user_agent ?? ""
  if (ua.includes("bun")) return "bun"
  if (ua.includes("pnpm")) return "pnpm"
  if (ua.includes("yarn")) return "yarn"
  if (ua.includes("npm")) return "npm"
  const exec = process.env.npm_execpath ?? ""
  if (exec.includes("pnpm")) return "pnpm"
  if (exec.includes("bun")) return "bun"
  if (exec.includes("yarn")) return "yarn"
  if (exec.includes("npm")) return "npm"
  return "npm"
}

function runCmd(pm: PackageManager, script: string): string {
  switch (pm) {
    case "pnpm":
      return `pnpm ${script}`
    case "bun":
      return script === "install" ? "bun install" : `bun run ${script}`
    case "yarn":
      return script === "install" ? "yarn" : `yarn ${script}`
    default:
      return script === "install" ? "npm install" : `npm run ${script}`
  }
}

function printHelp() {
  console.log(`
  🚂 create-potato — scaffold a Potato app

  Usage (npm / pnpm / bun):
    npm create potato@latest <name> -- [--template=spa|ssr]
    pnpm create potato <name> -- [--template=spa|ssr]
    bun create potato <name> [--template=spa|ssr]
    create-potato <name> [--spa|--ssr|--template=ssr] [--force] [--pm=npm|pnpm|bun]

  Note: with npm and pnpm, pass flags after \`--\` so they reach this CLI.

  Templates:
    spa   Vite + Tailwind + createApp + defineFeature  (default)
    ssr   Node server + Live WebSocket + Tailwind

  Product architecture:
    State + Events → createApp → defineFeature · patch · pure views
    Live: onEvent mutates session.state only
`)
}

function parseArgs(argv: string[]) {
  const force = argv.includes("--force") || argv.includes("-f")
  let pmFlag: string | undefined
  const pmEq = argv.find((a) => a.startsWith("--pm="))
  if (pmEq) pmFlag = pmEq.split("=")[1]
  const pmi = argv.indexOf("--pm")
  if (pmi >= 0 && argv[pmi + 1] && !argv[pmi + 1]!.startsWith("-")) {
    pmFlag = argv[pmi + 1]
  }

  let tplArg = argv.find((a) => a.startsWith("--template="))?.split("=")[1]
  if (!tplArg) {
    const i = argv.indexOf("--template")
    if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("-")) {
      tplArg = argv[i + 1]
    }
  }
  let template: Template = "spa"
  if (argv.includes("--ssr")) template = "ssr"
  else if (argv.includes("--spa")) template = "spa"
  else if (tplArg) {
    if (!(templates as readonly string[]).includes(tplArg)) {
      console.error(
        `Unknown template: ${tplArg}. Use: ${templates.join(", ")}`,
      )
      process.exit(1)
    }
    template = tplArg as Template
  }

  const name =
    argv.find(
      (a) =>
        !a.startsWith("-") &&
        a !== tplArg &&
        a !== pmFlag,
    ) ?? "my-potato-app"

  return { name, template, force, pmFlag }
}

async function assertEmptyOrForce(target: string, force: boolean) {
  try {
    await access(target)
  } catch {
    return
  }
  const st = await stat(target)
  if (!st.isDirectory()) {
    console.error(`Target exists and is not a directory: ${target}`)
    process.exit(1)
  }
  const entries = await readdir(target)
  if (entries.length > 0 && !force) {
    console.error(
      `Directory not empty: ${target}\n  Re-run with --force to overwrite, or choose another name.`,
    )
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes("-h") || args.includes("--help")) {
    printHelp()
    return
  }

  const { name, template, force, pmFlag } = parseArgs(args)
  const pm = detectPackageManager(pmFlag)
  const install = runCmd(pm, "install")
  const dev = runCmd(pm, "dev")

  const target = resolve(process.cwd(), name)
  await assertEmptyOrForce(target, force)

  console.log(`\n  🚂 create-potato → ${name} (${template})\n`)

  await mkdir(target, { recursive: true })

  const bundled = resolve(__dirname, "../templates", template)
  try {
    await access(bundled)
    await access(join(bundled, "package.json"))
  } catch {
    console.error(`Template missing or incomplete:\n  ${bundled}`)
    console.error(
      `Expected package.json under templates/${template}. Reinstall create-potato@latest.`,
    )
    process.exit(1)
  }

  try {
    await cp(bundled, target, {
      recursive: true,
      filter: shouldCopy,
      force: true,
    })
  } catch (err) {
    console.error(`Failed to copy template from:\n  ${bundled}`)
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }

  const pkgPath = join(target, "package.json")
  try {
    await access(pkgPath)
  } catch {
    console.error(
      `Template copy produced no package.json at ${pkgPath}\n` +
        `This usually means an old create-potato filtered out templates under node_modules.\n` +
        `Upgrade to create-potato@0.2.1+ or: node packages/create-potato/dist/cli.js …`,
    )
    process.exit(1)
  }

  const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
    name: string
    scripts?: Record<string, string>
  }
  pkg.name = basename(name)
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n")

  // Required files per template
  const required =
    template === "ssr"
      ? ["src/server.ts", "src/app.tsx", "tsconfig.json"]
      : ["src/main.tsx", "vite.config.ts", "index.html"]
  for (const rel of required) {
    try {
      await access(join(target, rel))
    } catch {
      console.error(`Scaffold incomplete — missing ${rel}`)
      process.exit(1)
    }
  }

  await writeFile(
    join(target, "README.md"),
    `# ${name}

Scaffolded with **create-potato** (${template}).

## Architecture

- \`createApp<State, Events>\` — only app entry
- \`defineFeature\` — state slice + typed events + handlers
- \`patch()\` — update state and re-render
- Views are **pure** — no fetch/set in UI (SSR \`emit\` is a no-op)
${
  template === "ssr"
    ? "- Live: \`onEvent\` mutates **session.state only** (not \`app.emitter\`)\n"
    : ""
}- Refactors via **TypeScript**, not grep

## Commands

\`\`\`bash
${install}
${dev}
\`\`\`

Also works with npm / pnpm / bun interchangeably.

${
  template === "ssr"
    ? "Server: http://localhost:3000 (override with `PORT`). Health: `GET /api/health`.\n"
    : "Vite: http://localhost:5173.\n"
}
`,
  )

  console.log(`  Done! Next:

    cd ${name}
    ${install}
    ${dev}

  Type spine: State · Events · defineFeature · patch · pure views
`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
