#!/usr/bin/env node
/**
 * create-potato — scaffold apps on the product architecture:
 *   createApp + State + Events + defineFeature + patch
 *   (types, not grep)
 */
import { mkdir, writeFile, cp, access, readFile } from "node:fs/promises"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Shipped templates only (standalone, no monorepo workspace:*) */
const templates = ["spa", "ssr"] as const
type Template = (typeof templates)[number]

function printHelp() {
  console.log(`
  🚂 create-potato — scaffold a Potato app

  Usage:
    pnpm create potato <name> [--template=spa|ssr]
    create-potato <name> [--spa|--ssr]

  Templates:
    spa   Vite + Tailwind + createApp + defineFeature  (default)
    ssr   Node server + API + same type spine + Tailwind

  Product architecture (always):
    State + Events → createApp → defineFeature → patch → view emit only
`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes("-h") || args.includes("--help")) {
    printHelp()
    return
  }

  const name = args.find((a) => !a.startsWith("-")) ?? "my-potato-app"
  const tplArg = args.find((a) => a.startsWith("--template="))?.split("=")[1]
  const template = (tplArg as Template) || detectTemplate(args) || "spa"

  if (!templates.includes(template)) {
    console.error(
      `Unknown template: ${template}. Use: ${templates.join(", ")}\n` +
        `(Heavy demos like spreadsheet / trello / cloudflare live under examples/ in the monorepo.)`,
    )
    process.exit(1)
  }

  const target = resolve(process.cwd(), name)
  console.log(`\n  🚂 create-potato → ${name} (${template})\n`)

  await mkdir(target, { recursive: true })

  const bundled = resolve(__dirname, "../templates", template)
  try {
    await access(bundled)
    await cp(bundled, target, {
      recursive: true,
      filter: (p) => !p.includes("node_modules") && !p.includes("dist"),
    })
    const pkgPath = join(target, "package.json")
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
      name: string
    }
    pkg.name = basename(name)
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
  } catch {
    console.error(`Template missing: ${bundled}`)
    process.exit(1)
  }

  // Small README for the generated app
  await writeFile(
    join(target, "README.md"),
    `# ${name}

Scaffolded with **create-potato** (${template}).

## Architecture

- \`createApp<State, Events>\` — only app entry
- \`defineFeature\` — state slice + typed events + handlers
- \`patch()\` — update state and re-render
- Views only \`emit\` — no fetch/set in UI
- Refactors via **TypeScript**, not grep

## Commands

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

See Potato monorepo docs: \`docs/architecture.md\`, \`AGENTS.md\`.
`,
  )

  console.log(`  Done! Next:

    cd ${name}
    pnpm install
    pnpm dev

  Type spine: State · Events · defineFeature · patch · emit
`)
}

function detectTemplate(args: string[]): Template | null {
  if (args.includes("--ssr")) return "ssr"
  if (args.includes("--spa")) return "spa"
  return null
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
