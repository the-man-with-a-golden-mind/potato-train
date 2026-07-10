import { isVNode, normalizeChildren } from "./vnode.js"
import type {
  AppState,
  ComponentFn,
  Emit,
  PotatoChild,
  Props,
  VNode,
} from "./types.js"

const SVG_NS = "http://www.w3.org/2000/svg"
const XLINK_NS = "http://www.w3.org/1999/xlink"

const SKIP_PROPS = new Set([
  "children",
  "key",
  "ref",
  "dangerouslySetInnerHTML",
])

export interface RenderContext {
  state: AppState
  emit: Emit
  /** For SVG namespace tracking */
  ns?: string
}

/**
 * Morph / patch DOM from a VNode tree.
 * Real-DOM oriented (nanomorph spirit) but driven by VNodes for SSR/JSX.
 */
export function createRoot(ctx: RenderContext) {
  let current: VNode | string | number | null = null
  let rootEl: Element | null = null

  const mount = (container: Element, tree: PotatoChild): Element => {
    const normalized = firstNode(tree)
    const el = createNode(normalized, ctx) as Element
    container.replaceChildren(el)
    rootEl = el
    current = isVNode(normalized) ? normalized : String(normalized)
    return el
  }

  const update = (tree: PotatoChild): void => {
    if (!rootEl || !rootEl.parentNode) return
    const next = firstNode(tree)
    const parent = rootEl.parentNode
    const result = patch(parent, rootEl, current, next, ctx)
    if (result instanceof Element) {
      rootEl = result
    } else if (result) {
      // text root — wrap not expected at root; replace
      const el = createNode(next, ctx) as Element
      parent.replaceChild(el, rootEl)
      rootEl = el
    }
    current = isVNode(next) ? next : String(next)
  }

  return { mount, update, get root() { return rootEl } }
}

function firstNode(tree: PotatoChild): VNode | string | number {
  const kids = normalizeChildren(tree)
  if (kids.length === 0) return hEmpty()
  if (kids.length === 1) return kids[0]!
  // Multiple roots → fragment wrapper
  return {
    type: "div",
    props: { "data-potato-root": "", children: kids },
  }
}

function hEmpty(): VNode {
  return { type: "div", props: { "data-potato-empty": "" } }
}

function createNode(
  vnode: VNode | string | number,
  ctx: RenderContext,
): Node {
  if (typeof vnode === "string" || typeof vnode === "number") {
    return document.createTextNode(String(vnode))
  }

  if (typeof vnode.type === "function") {
    return createComponent(vnode, ctx)
  }

  const isSvg =
    vnode.type === "svg" || ctx.ns === SVG_NS || vnode.type === "path"
  const ns = isSvg ? SVG_NS : undefined
  const el = ns
    ? document.createElementNS(ns, vnode.type)
    : document.createElement(vnode.type)

  setProps(el, {}, vnode.props, ns)
  const childCtx = ns ? { ...ctx, ns } : ctx
  appendChildren(el, vnode.props.children, childCtx)
  vnode._el = el
  callRef(vnode.props, el)
  return el
}

function createComponent(vnode: VNode, ctx: RenderContext): Node {
  const fn = vnode.type as ComponentFn
  const id =
    (vnode.props.key != null ? String(vnode.props.key) : undefined) ??
    (fn.name || "anon")
  const rendered = fn(vnode.props, {
    state: ctx.state,
    emit: ctx.emit,
    id,
  })
  const kids = normalizeChildren(rendered)
  if (kids.length === 0) {
    const empty = document.createComment("potato")
    vnode._el = empty
    return empty
  }
  if (kids.length === 1) {
    const node = createNode(kids[0]!, ctx)
    vnode._el = node
    return node
  }
  const frag = document.createDocumentFragment()
  for (const k of kids) frag.appendChild(createNode(k, ctx))
  // Can't return fragment as root for morph easily — wrap
  const wrap = document.createElement("div")
  wrap.setAttribute("data-potato-frag", "")
  wrap.appendChild(frag)
  vnode._el = wrap
  return wrap
}

function appendChildren(
  el: Element,
  children: unknown,
  ctx: RenderContext,
): void {
  if (children == null || children === false) return
  if (
    typeof children === "object" &&
    children !== null &&
    "dangerouslySetInnerHTML" in (children as object)
  ) {
    return
  }
  for (const child of normalizeChildren(children as PotatoChild)) {
    el.appendChild(createNode(child, ctx))
  }
}

function patch(
  parent: Node,
  dom: Node,
  oldV: VNode | string | number | null,
  nextV: VNode | string | number,
  ctx: RenderContext,
): Node | null {
  if (oldV === null) {
    const n = createNode(nextV, ctx)
    parent.appendChild(n)
    return n
  }

  // Text ↔ text
  if (
    (typeof oldV === "string" || typeof oldV === "number") &&
    (typeof nextV === "string" || typeof nextV === "number")
  ) {
    if (String(oldV) !== String(nextV)) {
      dom.textContent = String(nextV)
    }
    return dom
  }

  // Type change → replace
  if (
    typeof oldV !== typeof nextV ||
    (isVNode(oldV) &&
      isVNode(nextV) &&
      (oldV.type !== nextV.type || oldV.key !== nextV.key)) ||
    typeof oldV === "string" ||
    typeof nextV === "string" ||
    typeof oldV === "number" ||
    typeof nextV === "number"
  ) {
    const n = createNode(nextV, ctx)
    parent.replaceChild(n, dom)
    return n
  }

  if (!isVNode(oldV) || !isVNode(nextV)) return dom

  // Components
  if (typeof nextV.type === "function") {
    const fn = nextV.type as ComponentFn
    const id =
      (nextV.props.key != null ? String(nextV.props.key) : undefined) ??
      (fn.name || "anon")
    const rendered = fn(nextV.props, {
      state: ctx.state,
      emit: ctx.emit,
      id,
    })
    const nextChild = firstNode(rendered)
    const oldRendered = (oldV as VNode & { _last?: PotatoChild })._last
    const oldChild = oldRendered != null ? firstNode(oldRendered) : null
    ;(nextV as VNode & { _last?: PotatoChild })._last = rendered
    return patch(parent, dom, oldChild, nextChild, ctx)
  }

  const el = dom as Element
  setProps(el, oldV.props, nextV.props, ctx.ns)
  patchChildren(el, oldV.props.children, nextV.props.children, ctx)
  nextV._el = el
  callRef(nextV.props, el)
  return el
}

function patchChildren(
  el: Element,
  oldChildren: unknown,
  nextChildren: unknown,
  ctx: RenderContext,
): void {
  if (
    nextChildren &&
    typeof nextChildren === "object" &&
    "dangerouslySetInnerHTML" in (nextChildren as object)
  ) {
    return
  }

  const oldList = normalizeChildren((oldChildren as PotatoChild) ?? null)
  const nextList = normalizeChildren((nextChildren as PotatoChild) ?? null)
  const childNodes = [...el.childNodes]

  const oldChildrenWithDom = oldList
    .map((vnode, idx) => ({
      vnode,
      dom: childNodes[idx],
      reused: false,
    }))
    .filter((x) => x.dom !== undefined) as Array<{
    vnode: VNode | string | number
    dom: Node
    reused: boolean
  }>

  const oldKeyed = new Map<string | number, { vnode: VNode; dom: Node; originalIdx: number }>()
  for (let idx = 0; idx < oldChildrenWithDom.length; idx++) {
    const item = oldChildrenWithDom[idx]!
    const v = item.vnode
    if (isVNode(v) && v.key != null) {
      oldKeyed.set(v.key, { vnode: v, dom: item.dom, originalIdx: idx })
    }
  }

  for (let i = 0; i < nextList.length; i++) {
    const next = nextList[i]!
    let matchedDom: Node | null = null
    let matchedVNode: VNode | string | number | null = null

    if (isVNode(next) && next.key != null) {
      const match = oldKeyed.get(next.key)
      if (match) {
        oldChildrenWithDom[match.originalIdx]!.reused = true
        matchedDom = match.dom
        matchedVNode = match.vnode
      }
    } else {
      // Find first unused, unkeyed old child
      for (let j = 0; j < oldChildrenWithDom.length; j++) {
        const oldChild = oldChildrenWithDom[j]!
        if (!oldChild.reused) {
          const o = oldChild.vnode
          const isOldKeyed = isVNode(o) && o.key != null
          if (!isOldKeyed) {
            oldChild.reused = true
            matchedDom = oldChild.dom
            matchedVNode = oldChild.vnode
            break
          }
        }
      }
    }

    const currentDom = el.childNodes[i]
    if (matchedDom) {
      if (currentDom !== matchedDom) {
        el.insertBefore(matchedDom, currentDom ?? null)
      }
      patch(el, matchedDom, matchedVNode!, next, ctx)
    } else {
      const n = createNode(next, ctx)
      el.insertBefore(n, currentDom ?? null)
    }
  }

  // clean up unused
  for (const oldChild of oldChildrenWithDom) {
    if (!oldChild.reused && oldChild.dom.parentNode === el) {
      el.removeChild(oldChild.dom)
    }
  }
}

function setProps(
  el: Element,
  oldProps: Props,
  nextProps: Props,
  ns?: string,
): void {
  // remove old
  for (const key of Object.keys(oldProps)) {
    if (SKIP_PROPS.has(key)) continue
    if (!(key in nextProps)) {
      removeProp(el, key, oldProps[key])
    }
  }

  for (const [key, value] of Object.entries(nextProps)) {
    if (SKIP_PROPS.has(key)) continue
    if (oldProps[key] === value && key !== "value" && key !== "checked") continue
    setProp(el, key, value, oldProps[key], ns)
  }

  if (nextProps.dangerouslySetInnerHTML) {
    el.innerHTML = nextProps.dangerouslySetInnerHTML.__html
  }
}

function setProp(
  el: Element,
  key: string,
  value: unknown,
  _old: unknown,
  ns?: string,
): void {
  if (key.startsWith("on") && typeof value === "function") {
    const event = key.slice(2).toLowerCase()
    const anyEl = el as Element & { _potatoHandlers?: Record<string, EventListener> }
    anyEl._potatoHandlers ??= {}
    if (anyEl._potatoHandlers[event]) {
      el.removeEventListener(event, anyEl._potatoHandlers[event]!)
    }
    const handler = value as EventListener
    anyEl._potatoHandlers[event] = handler
    el.addEventListener(event, handler)
    return
  }

  if (key === "className" || key === "class") {
    el.setAttribute("class", classNames(value))
    return
  }

  if (key === "style" && value && typeof value === "object") {
    const styleEl = el as HTMLElement
    const prev =
      _old && typeof _old === "object" && !Array.isArray(_old)
        ? (_old as Record<string, unknown>)
        : null
    if (prev) {
      for (const k of Object.keys(prev)) {
        if (!(k in (value as object))) {
          // Clear removed CSS properties so stale styles do not stick
          ;(styleEl.style as unknown as Record<string, string>)[k] = ""
        }
      }
    }
    Object.assign(styleEl.style, value)
    return
  }

  if (key === "style" && typeof value === "string") {
    el.setAttribute("style", value)
    return
  }

  if (key === "value" && "value" in el) {
    // Don't clobber caret while the user is typing in this field
    if (document.activeElement === el) return
    ;(el as HTMLInputElement).value = value == null ? "" : String(value)
    return
  }

  if (key === "checked" && "checked" in el) {
    ;(el as HTMLInputElement).checked = Boolean(value)
    return
  }

  if (typeof value === "boolean") {
    if (value) el.setAttribute(key, "")
    else el.removeAttribute(key)
    return
  }

  if (value == null) {
    el.removeAttribute(key)
    return
  }

  if (ns && key.startsWith("xlink:")) {
    el.setAttributeNS(XLINK_NS, key, String(value))
    return
  }

  el.setAttribute(key, String(value))
}

function removeProp(el: Element, key: string, old: unknown): void {
  if (key.startsWith("on") && typeof old === "function") {
    const event = key.slice(2).toLowerCase()
    const anyEl = el as Element & { _potatoHandlers?: Record<string, EventListener> }
    const h = anyEl._potatoHandlers?.[event]
    if (h) el.removeEventListener(event, h)
    return
  }
  if (key === "className" || key === "class") {
    el.removeAttribute("class")
    return
  }
  if (key === "style") {
    const styleEl = el as HTMLElement
    if (old && typeof old === "object" && !Array.isArray(old)) {
      for (const k of Object.keys(old as object)) {
        ;(styleEl.style as unknown as Record<string, string>)[k] = ""
      }
    }
    styleEl.removeAttribute("style")
    return
  }
  el.removeAttribute(key)
}

function classNames(value: unknown): string {
  if (!value) return ""
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.filter(Boolean).join(" ")
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k)
      .join(" ")
  }
  return String(value)
}

function callRef(props: Props, el: Element | null): void {
  if (typeof props.ref === "function") props.ref(el)
}

/** Render VNode tree to HTML string (SSR). */
export function renderToString(tree: PotatoChild, ctx?: Partial<RenderContext>): string {
  const state = (ctx?.state ?? {
    events: {} as AppState["events"],
    params: {},
    query: {},
    href: "/",
    route: "/",
    title: "",
    cache: (() => {
      throw new Error("cache unavailable during bare SSR")
    }) as AppState["cache"],
  }) as AppState
  const emit = ctx?.emit ?? (() => {})
  return serialize(tree, { state, emit })
}

function serialize(tree: PotatoChild, ctx: RenderContext): string {
  const kids = normalizeChildren(tree)
  return kids.map((k) => serializeNode(k, ctx)).join("")
}

function serializeNode(
  node: VNode | string | number,
  ctx: RenderContext,
): string {
  if (typeof node === "string") return escapeHtml(node)
  if (typeof node === "number") return String(node)

  if (typeof node.type === "function") {
    const fn = node.type as ComponentFn
    const rendered = fn(node.props, {
      state: ctx.state,
      emit: ctx.emit,
      id: String(node.props.key ?? fn.name ?? "anon"),
    })
    return serialize(rendered, ctx)
  }

  const tag = node.type
  if (tag === "" || tag === FragmentTag) {
    return serialize(node.props.children as PotatoChild, ctx)
  }

  const attrs = serializeAttrs(node.props)
  const voidTags = VOID_ELEMENTS.has(tag)

  if (node.props.dangerouslySetInnerHTML) {
    const html = node.props.dangerouslySetInnerHTML.__html
    return `<${tag}${attrs}>${html}</${tag}>`
  }

  if (voidTags) return `<${tag}${attrs}/>`

  const children = serialize(node.props.children as PotatoChild, ctx)
  return `<${tag}${attrs}>${children}</${tag}>`
}

const FragmentTag = "Fragment"

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
])

function serializeAttrs(props: Props): string {
  let out = ""
  for (const [key, value] of Object.entries(props)) {
    if (SKIP_PROPS.has(key)) continue
    if (key.startsWith("on")) continue
    if (value == null || value === false) continue
    if (key === "className" || key === "class") {
      const c = classNames(value)
      if (c) out += ` class="${escapeAttr(c)}"`
      continue
    }
    if (key === "style" && typeof value === "object" && value) {
      const style = Object.entries(value as Record<string, string>)
        .map(([k, v]) => `${camelToKebab(k)}:${v}`)
        .join(";")
      out += ` style="${escapeAttr(style)}"`
      continue
    }
    if (value === true) {
      out += ` ${key}`
      continue
    }
    out += ` ${key === "className" ? "class" : key}="${escapeAttr(String(value))}"`
  }
  return out
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}
