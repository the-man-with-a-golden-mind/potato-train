import type { Plugin } from "vite"

export interface PotatoViteOptions {
  /** JSX import source. Default @potato/jsx */
  jsxImportSource?: string
  /** Enable potato devtools hint in HTML. Default true in serve */
  devtoolsComment?: boolean
}

/**
 * Official Vite plugin for Potato apps.
 *
 * @example
 * ```ts
 * import { potato } from '@potato/vite-plugin'
 * export default { plugins: [potato()] }
 * ```
 */
export function potato(opts: PotatoViteOptions = {}): Plugin {
  const jsxImportSource = opts.jsxImportSource ?? "@potato/jsx"

  return {
    name: "potato",
    config() {
      return {
        esbuild: {
          jsx: "automatic",
          jsxImportSource,
        },
        optimizeDeps: {
          include: ["@potato/core", "@potato/jsx", "@potato/html"],
        },
        resolve: {
          dedupe: ["@potato/core"],
        },
      }
    },
    transformIndexHtml(html, ctx) {
      if (opts.devtoolsComment === false) return html
      if (ctx.server) {
        const tip =
          "<!-- Potato: app.use(devtools()) from @potato/debug → window.__POTATO__ -->"
        if (html.includes(tip)) return html
        return html.replace("<head>", `<head>\n    ${tip}`)
      }
      return html
    },
  }
}

export default potato
