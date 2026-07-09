#!/usr/bin/env node
/**
 * Typecheck eval reference solutions (must pass).
 */
import { spawnSync } from "node:child_process"
import { readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const tasksDir = join(root, "eval/tasks")
const tasks = readdirSync(tasksDir).filter((d) =>
  existsSync(join(tasksDir, d, "solution")),
)

let failed = 0
const tmp = join(root, "eval/.tmp")
mkdirSync(tmp, { recursive: true })

for (const task of tasks) {
  const sol = join(tasksDir, task, "solution")
  const tsconfig = {
    extends: "../../tsconfig.base.json",
    compilerOptions: {
      noEmit: true,
      paths: {
        "@potato/core": ["../../packages/core/src/index.ts"],
      },
      baseUrl: ".",
    },
    include: ["./**/*.ts"],
  }
  // write per-task config in solution dir
  writeFileSync(
    join(sol, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          paths: {
            "@potato/core": [resolve(root, "packages/core/src/index.ts")],
          },
          baseUrl: ".",
        },
        include: ["./**/*.ts"],
      },
      null,
      2,
    ),
  )

  const tsc = resolve(root, "packages/core/node_modules/typescript/bin/tsc")
  const tscAlt = resolve(root, "node_modules/typescript/bin/tsc")
  const tscBin = existsSync(tsc) ? tsc : tscAlt
  const r = spawnSync(process.execPath, [tscBin, "-p", sol], {
    cwd: root,
    encoding: "utf8",
  })
  const ok = r.status === 0
  console.log(`${ok ? "PASS" : "FAIL"}  ${task}`)
  if (!ok) {
    failed++
    console.log(r.stdout || r.stderr)
  }
}

if (failed) {
  console.error(`\n${failed} eval solution(s) failed typecheck`)
  process.exit(1)
}
console.log(`\nAll ${tasks.length} solutions typecheck.`)
