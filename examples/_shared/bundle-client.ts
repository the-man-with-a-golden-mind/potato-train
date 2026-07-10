/**
 * Shared esbuild client bundler for Potato examples.
 * Produces dist/client.js (+ map) and helpers to serve it.
 */
import * as esbuild from "esbuild"
import { mkdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export type BundleClientOptions = {
  /** Absolute path to client entry (e.g. .../src/client.tsx) */
  entry: string
  /** Example root directory (contains dist/) */
  exampleRoot: string
  /** Label for log line */
  label?: string
  /** Extra package aliases under monorepo packages/ */
  packages?: string[]
  /** Extra path aliases (absolute) */
  alias?: Record<string, string>
  jsx?: boolean
}

function monorepoRootFromExample(exampleRoot: string): string {
  // examples/<name> → monorepo root
  return join(exampleRoot, "../..")
}

/**
 * Bundle a browser client to `<exampleRoot>/dist/client.js`.
 * @returns absolute path to the outfile
 */
export async function bundleClient(opts: BundleClientOptions): Promise<string> {
  const outDir = join(opts.exampleRoot, "dist")
  const outfile = join(outDir, "client.js")
  await mkdir(outDir, { recursive: true })

  const monorepo = monorepoRootFromExample(opts.exampleRoot)
  const aliasPkg = (name: string, sub = "src/index.ts") =>
    join(monorepo, "packages", name, sub)

  const pkgs = opts.packages ?? ["core", "jsx"]
  const alias: Record<string, string> = {
    ...Object.fromEntries(
      pkgs.flatMap((name) => {
        const entries: [string, string][] = [
          [`potato-train-${name}`, aliasPkg(name)],
        ]
        if (name === "jsx") {
          entries.push(
            ["potato-train-jsx/jsx-runtime", aliasPkg("jsx", "src/jsx-runtime.ts")],
            [
              "potato-train-jsx/jsx-dev-runtime",
              aliasPkg("jsx", "src/jsx-dev-runtime.ts"),
            ],
          )
        }
        if (name === "live") {
          entries.push([
            "potato-train-live/client",
            join(monorepo, "packages/live/src/client.ts"),
          ])
        }
        return entries
      }),
    ),
    ...opts.alias,
  }

  const useJsx = opts.jsx !== false
  await esbuild.build({
    entryPoints: [opts.entry],
    bundle: true,
    outfile,
    format: "esm",
    platform: "browser",
    target: "es2022",
    sourcemap: true,
    logLevel: "warning",
    ...(useJsx
      ? {
          jsx: "automatic" as const,
          jsxImportSource: "potato-train-jsx",
        }
      : {}),
    alias,
  })

  const label = opts.label ?? "client"
  console.log(`[potato-${label}] client → dist/client.js`)
  return outfile
}

/** Resolve example root from a file under `src/` (import.meta.url). */
export function exampleRootFromSrc(metaUrl: string): string {
  return join(dirname(fileURLToPath(metaUrl)), "..")
}

/** Read bundled client JS (utf8). */
export async function readClientJs(exampleRoot: string): Promise<string> {
  return readFile(join(exampleRoot, "dist/client.js"), "utf8")
}

/** Read source map if present. */
export async function readClientMap(
  exampleRoot: string,
): Promise<string | null> {
  try {
    return await readFile(join(exampleRoot, "dist/client.js.map"), "utf8")
  } catch {
    return null
  }
}

/**
 * Register GET /assets/client.js (+ .map) on a Potato server-like router.
 */
export function mountClientAssets(
  server: {
    get: (
      path: string,
      handler: (ctx: {
        headers: Headers
        text: (b: string, s?: number) => Response
      }) => Promise<Response> | Response,
    ) => void
  },
  exampleRoot: string,
): void {
  server.get("/assets/client.js", async (ctx) => {
    const js = await readClientJs(exampleRoot)
    ctx.headers.set("content-type", "text/javascript; charset=utf-8")
    ctx.headers.set("cache-control", "no-store")
    return new Response(js, { status: 200, headers: ctx.headers })
  })

  server.get("/assets/client.js.map", async (ctx) => {
    const map = await readClientMap(exampleRoot)
    if (!map) return ctx.text("missing", 404)
    return new Response(map, {
      headers: { "content-type": "application/json" },
    })
  })
}
