/**
 * Real-DOM morph from an HTML string (LiveView patches).
 * Preserves focused inputs when possible; keyed by id when present.
 */

const SKIP = new Set([
  "textarea",
  "input",
  "option",
  "select",
])

/**
 * Morph `target`'s children to match `html` (fragment or single root inner HTML).
 * If html is a full document fragment with multiple roots, all are applied as children.
 */
export function morphHtml(target: Element, html: string): void {
  const focused = document.activeElement as HTMLElement | null
  const focusKey =
    focused && target.contains(focused)
      ? focused.id || focused.getAttribute("name") || focused.getAttribute("data-potato-click")
      : null
  const selStart =
    focused && "selectionStart" in focused
      ? (focused as HTMLInputElement).selectionStart
      : null
  const selEnd =
    focused && "selectionEnd" in focused
      ? (focused as HTMLInputElement).selectionEnd
      : null

  const template = document.createElement("template")
  template.innerHTML = html.trim()
  morphChildren(target, template.content)

  if (focusKey) {
    const next =
      (focusKey && target.querySelector(`#${cssEscape(focusKey)}`)) ||
      target.querySelector(`[name="${cssEscape(focusKey)}"]`) ||
      target.querySelector(`[data-potato-click="${cssEscape(focusKey)}"]`)
    if (next instanceof HTMLElement) {
      next.focus()
      if (
        selStart != null &&
        "setSelectionRange" in next &&
        typeof (next as HTMLInputElement).setSelectionRange === "function"
      ) {
        try {
          ;(next as HTMLInputElement).setSelectionRange(selStart, selEnd ?? selStart)
        } catch {
          /* type=number etc. */
        }
      }
    }
  }
}

function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s)
  return s.replace(/"/g, '\\"')
}

function morphChildren(from: Element | DocumentFragment, to: ParentNode): void {
  const toNodes = [...to.childNodes]
  const fromNodes = [...from.childNodes]

  const fromNodesWithStatus = fromNodes.map((node) => ({
    node,
    reused: false,
  }))

  // keyed map by id
  const fromById = new Map<string, { node: Element; originalIdx: number }>()
  for (let idx = 0; idx < fromNodes.length; idx++) {
    const n = fromNodes[idx]!
    if (n.nodeType === 1) {
      const el = n as Element
      if (el.id) {
        fromById.set(el.id, { node: el, originalIdx: idx })
      }
    }
  }

  for (let ti = 0; ti < toNodes.length; ti++) {
    const toNode = toNodes[ti]!

    if (toNode.nodeType === 3 /* Text */) {
      // Find first unused old text node
      let matchedNode: ChildNode | null = null
      for (let j = 0; j < fromNodesWithStatus.length; j++) {
        const f = fromNodesWithStatus[j]!
        if (!f.reused && f.node.nodeType === 3) {
          matchedNode = f.node
          f.reused = true
          break
        }
      }

      const currentDom = from.childNodes[ti]
      if (matchedNode) {
        if (currentDom !== matchedNode) {
          from.insertBefore(matchedNode, currentDom ?? null)
        }
        if (matchedNode.nodeValue !== toNode.nodeValue) {
          matchedNode.nodeValue = toNode.nodeValue
        }
      } else {
        const n = document.createTextNode(toNode.nodeValue ?? "")
        from.insertBefore(n, currentDom ?? null)
      }
      continue
    }

    if (toNode.nodeType === 8 /* Comment */) {
      // Find first unused old comment node
      let matchedNode: ChildNode | null = null
      for (let j = 0; j < fromNodesWithStatus.length; j++) {
        const f = fromNodesWithStatus[j]!
        if (!f.reused && f.node.nodeType === 8) {
          matchedNode = f.node
          f.reused = true
          break
        }
      }

      const currentDom = from.childNodes[ti]
      if (matchedNode) {
        if (currentDom !== matchedNode) {
          from.insertBefore(matchedNode, currentDom ?? null)
        }
      } else {
        const n = document.createComment(toNode.nodeValue ?? "")
        from.insertBefore(n, currentDom ?? null)
      }
      continue
    }

    if (toNode.nodeType !== 1) continue
    const toEl = toNode as Element

    let matchedNode: Element | null = null

    // try id match
    if (toEl.id) {
      const match = fromById.get(toEl.id)
      if (match) {
        fromNodesWithStatus[match.originalIdx]!.reused = true
        matchedNode = match.node
      }
    } else {
      // Find first unused unkeyed node of same name
      for (let j = 0; j < fromNodesWithStatus.length; j++) {
        const f = fromNodesWithStatus[j]!
        if (!f.reused && f.node.nodeType === 1) {
          const el = f.node as Element
          if (!el.id && el.nodeName === toEl.nodeName) {
            f.reused = true
            matchedNode = el
            break
          }
        }
      }
    }

    const currentDom = from.childNodes[ti]
    if (matchedNode) {
      if (currentDom !== matchedNode) {
        from.insertBefore(matchedNode, currentDom ?? null)
      }
      morphElement(matchedNode, toEl)
    } else {
      const clone = toEl.cloneNode(false) as Element
      copyAttrs(clone, toEl)
      clone.innerHTML = toEl.innerHTML
      morphChildren(clone, toEl)
      from.insertBefore(clone, currentDom ?? null)
      morphElement(clone, toEl)
    }
  }

  // clean up unused
  for (const item of fromNodesWithStatus) {
    if (!item.reused && item.node.parentNode === from) {
      from.removeChild(item.node)
    }
  }
}

function morphElement(from: Element, to: Element): void {
  if (from.nodeName !== to.nodeName) {
    from.replaceWith(to.cloneNode(true))
    return
  }

  // special: skip deep morph for same input values when focused handled outside
  if (SKIP.has(from.nodeName.toLowerCase())) {
    copyAttrs(from, to)
    if (from instanceof HTMLInputElement && to instanceof HTMLInputElement) {
      if (from.type === "file") return
      if (document.activeElement !== from && from.value !== to.getAttribute("value")) {
        from.value = to.getAttribute("value") ?? ""
      }
      if (to.hasAttribute("checked")) from.checked = true
      else if (from.type === "checkbox" || from.type === "radio") {
        if (!to.hasAttribute("checked")) from.checked = false
      }
    }
    if (from instanceof HTMLTextAreaElement && to instanceof HTMLTextAreaElement) {
      if (document.activeElement !== from) {
        from.value = to.textContent ?? ""
      }
    }
    if (from instanceof HTMLOptionElement && to instanceof HTMLOptionElement) {
      from.selected = to.hasAttribute("selected")
    }
    return
  }

  copyAttrs(from, to)
  morphChildren(from, to)
}

function copyAttrs(from: Element, to: Element): void {
  // remove old
  const fromAttrs = from.getAttributeNames()
  for (const name of fromAttrs) {
    if (!to.hasAttribute(name)) from.removeAttribute(name)
  }
  // set new
  for (const attr of to.attributes) {
    if (from.getAttribute(attr.name) !== attr.value) {
      from.setAttribute(attr.name, attr.value)
    }
  }
}
