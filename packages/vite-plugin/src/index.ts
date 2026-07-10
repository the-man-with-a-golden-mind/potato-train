import type { Plugin } from "vite"

export interface PotatoViteOptions {
  /** JSX import source. Default potato-train-jsx */
  jsxImportSource?: string
  /** Enable potato devtools hint in HTML. Default true in serve */
  devtoolsComment?: boolean
}

/**
 * Official Vite plugin for Potato apps.
 *
 * @example
 * ```ts
 * import { potato } from 'potato-train-vite-plugin'
 * export default { plugins: [potato()] }
 * ```
 */
export function potato(opts: PotatoViteOptions = {}): Plugin {
  const jsxImportSource = opts.jsxImportSource ?? "potato-train-jsx"

  return {
    name: "potato",
    config() {
      return {
        esbuild: {
          jsx: "automatic",
          jsxImportSource,
        },
        optimizeDeps: {
          include: ["potato-train-core", "potato-train-jsx", "potato-train-html"],
        },
        resolve: {
          dedupe: ["potato-train-core"],
        },
      }
    },
    transformIndexHtml(html, ctx) {
      if (opts.devtoolsComment === false) return html
      if (ctx.server) {
        const tip =
          "<!-- Potato: app.use(devtools()) from potato-train-debug → window.__POTATO__ -->"
        if (html.includes(tip)) return html
        return html.replace("<head>", `<head>\n    ${tip}`)
      }
      return html
    },
  }
}

export default potato
