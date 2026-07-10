import { h, isVNode } from "potato-train-core"
import type { PotatoChild, Props, VNode } from "potato-train-core"

/**
 * Tagged template → VNode tree.
 *
 * @example
 * ```ts
 * html`<button onclick=${onclick}>count is ${state.count}</button>`
 * ```
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): VNode {
  const raw = buildString(strings, values)
  const placeholders = values
  // Parse a single root element from the template.
  return parseRoot(raw, placeholders)
}

function buildString(strings: TemplateStringsArray, values: unknown[]): string {
  let out = ""
  for (let i = 0; i < strings.length; i++) {
    out += strings[i]
    if (i < values.length) {
      const v = values[i]
      if (typeof v === "function") {
        out += `"__POTATO_FN_${i}__"`
      } else if (isVNode(v) || Array.isArray(v)) {
        out += `<!--__POTATO_CHILD_${i}__-->`
      } else if (v === null || v === undefined || v === false) {
        out += ""
      } else {
        out += escapeText(String(v))
      }
    }
  }
  return out.trim()
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function parseRoot(raw: string, values: unknown[]): VNode {
  // Lightweight tag parser for common cases (not a full HTML parser)
  const match = raw.match(/^<([a-zA-Z][\w:-]*)((?:\s+[^>]*?)?)(\/?)>([\s\S]*)<\/\1\s*>$|^<([a-zA-Z][\w:-]*)((?:\s+[^>]*?)?)\s*\/>$/)
  if (!match) {
    // Fallback: wrap in div
    return h("div", {
      dangerouslySetInnerHTML: { __html: stripPlaceholders(raw) },
    })
  }

  const tag = (match[1] ?? match[5])!
  const attrRaw = (match[2] ?? match[6] ?? "").trim()
  const selfClosing = Boolean(match[3] || match[5])
  const inner = match[4] ?? ""

  const props = parseAttrs(attrRaw, values)
  if (!selfClosing && inner) {
    props.children = parseChildren(inner, values)
  }
  return h(tag, props)
}

function stripPlaceholders(s: string): string {
  return s
    .replace(/"__POTATO_FN_\d+__"/g, "")
    .replace(/<!--__POTATO_CHILD_\d+__-->/g, "")
}

function parseAttrs(raw: string, values: unknown[]): Props {
  const props: Props = {}
  if (!raw) return props

  const re =
    /([:@a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw))) {
    const name = m[1]!
    const val = m[2] ?? m[3] ?? m[4] ?? true
    if (typeof val === "string") {
      const fn = val.match(/^__POTATO_FN_(\d+)__$/)
      if (fn) {
        props[name] = values[Number(fn[1])]
        continue
      }
      // boolean-ish
      if (val === "" && m[2] === undefined && m[3] === undefined) {
        props[name] = true
      } else {
        props[name] = val
      }
    } else {
      props[name] = val
    }
  }
  return props
}

function parseChildren(inner: string, values: unknown[]): PotatoChild {
  const parts: PotatoChild[] = []
  const re = /<!--__POTATO_CHILD_(\d+)__-->|<([a-zA-Z][\w:-]*)((?:\s+[^>]*?)?)(\/?)>|([^<]+)/g
  // Simpler: split by child placeholders and recursive tags
  let remaining = inner
  const tokenRe =
    /<!--__POTATO_CHILD_(\d+)__-->|(<([a-zA-Z][\w:-]*)[\s\S]*?<\/\3\s*>)|(<([a-zA-Z][\w:-]*)[^>]*\/>)|([^<]+)/g
  let tm: RegExpExecArray | null
  while ((tm = tokenRe.exec(inner))) {
    if (tm[1] !== undefined) {
      const v = values[Number(tm[1])]
      if (Array.isArray(v)) parts.push(...(v as PotatoChild[]))
      else parts.push(v as PotatoChild)
    } else if (tm[2]) {
      parts.push(parseRoot(tm[2], values))
    } else if (tm[4]) {
      parts.push(parseRoot(tm[4], values))
    } else if (tm[6]) {
      const text = tm[6]
      if (text.trim()) parts.push(text)
    }
    remaining = remaining // silence unused
  }
  if (parts.length === 0) {
    // maybe only text / nested without matching
    if (inner.trim()) {
      const childPh = inner.match(/^<!--__POTATO_CHILD_(\d+)__-->$/)
      if (childPh) return values[Number(childPh[1])] as PotatoChild
      return inner
    }
    return null
  }
  return parts.length === 1 ? parts[0]! : parts
}

/** Unescaped raw HTML injection. */
export function raw(htmlString: string): VNode {
  return h("span", { dangerouslySetInnerHTML: { __html: htmlString } })
}

export { h } from "potato-train-core"
