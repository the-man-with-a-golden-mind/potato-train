import type { ComponentFn, PotatoChild, Props, VNode } from "./types.js"

const EMPTY: Props = {}

/** Create a VNode — the `h` hyperscript primitive. */
export function h(
  type: string | ComponentFn,
  props: Props | null,
  ...children: PotatoChild[]
): VNode {
  const p: Props = props ? { ...props } : { ...EMPTY }
  const flat = flatten(children)
  if (flat.length === 1) {
    p.children = flat[0]
  } else if (flat.length > 1) {
    p.children = flat
  }
  const key = p.key
  return { type, props: p, key }
}

function flatten(children: PotatoChild[], acc: PotatoChild[] = []): PotatoChild[] {
  for (const c of children) {
    /* v8 ignore next */
    if (c === null || c === undefined || c === false || c === true) continue
    if (Array.isArray(c)) flatten(c, acc)
    else acc.push(c)
  }
  return acc
}

export function isVNode(x: unknown): x is VNode {
  return (
    typeof x === "object" &&
    x !== null &&
    "type" in x &&
    "props" in x
  )
}

/** Normalize any PotatoChild into a renderable list of leaves. */
export function normalizeChildren(child: PotatoChild): Array<VNode | string | number> {
  const out: Array<VNode | string | number> = []
  const walk = (c: PotatoChild): void => {
    if (c === null || c === undefined || c === false || c === true) return
    if (Array.isArray(c)) {
      for (const x of c) walk(x)
      return
    }
    if (typeof c === "string" || typeof c === "number") {
      out.push(c)
      return
    }
    out.push(c)
  }
  walk(child)
  return out
}

/** Fragment helper */
export const Fragment = Symbol.for("potato.fragment") as unknown as ComponentFn

export function fragment(props: Props): PotatoChild {
  /* v8 ignore next */
  return props.children ?? null
}
