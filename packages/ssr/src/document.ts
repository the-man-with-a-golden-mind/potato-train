import type { AppState } from "@potato/core"

export interface DocumentOptions {
  title?: string
  lang?: string
  head?: string
  scripts?: string[]
  styles?: string[]
  bodyAttrs?: string
  /** Element id for app mount. Default "app" */
  rootId?: string
  state?: Partial<AppState>
  /** Hydration script src */
  clientEntry?: string
  /** LiveView websocket path */
  livePath?: string
}

/** Wrap app HTML in a full document shell with state rehydration. */
export function documentHtml(body: string, opts: DocumentOptions = {}): string {
  /* v8 ignore next 3 — optional chaining defaults */
  const rootId = opts.rootId ?? "app"
  const title = opts.title ?? opts.state?.title ?? "Potato"
  const lang = opts.lang ?? "en"
  const stateJson = JSON.stringify(opts.state ?? {}).replace(/</g, "\\u003c")
  const styles = (opts.styles ?? [])
    .map((s) =>
      s.startsWith("<") ? s : `<link rel="stylesheet" href="${s}"/>`,
    )
    .join("\n")
  const scripts = (opts.scripts ?? [])
    .map((s) => (s.startsWith("<") ? s : `<script type="module" src="${s}"></script>`))
    .join("\n")
  /* v8 ignore next 3 */
  const client = opts.clientEntry
    ? `<script type="module" src="${opts.clientEntry}"></script>`
    : ""
  /* v8 ignore next 3 */
  const live =
    opts.livePath != null
      ? `<script>window.__POTATO_LIVE__=${JSON.stringify(opts.livePath)}</script>`
      : ""


  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escape(title)}</title>
  ${styles}
  ${opts.head ?? ""}
  <script>window.__POTATO_STATE__=${stateJson}</script>
  ${live}
</head>
<body ${opts.bodyAttrs ?? ""}>
  <div id="${rootId}">${body}</div>
  ${client}
  ${scripts}
</body>
</html>`
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
