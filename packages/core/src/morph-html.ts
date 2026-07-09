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

  // keyed map by id
  const fromById = new Map<string, Element>()
  for (const n of fromNodes) {
    if (n.nodeType === 1) {
      const el = n as Element
      if (el.id) fromById.set(el.id, el)
    }
  }

  let fi = 0
  for (let ti = 0; ti < toNodes.length; ti++) {
    const toNode = toNodes[ti]!
    const fromNode = from.childNodes[fi] as ChildNode | undefined

    if (toNode.nodeType === 3 /* Text */) {
      if (fromNode && fromNode.nodeType === 3) {
        if (fromNode.nodeValue !== toNode.nodeValue) {
          fromNode.nodeValue = toNode.nodeValue
        }
        fi++
      } else {
        from.insertBefore(document.createTextNode(toNode.nodeValue ?? ""), fromNode ?? null)
        fi++
      }
      continue
    }

    if (toNode.nodeType === 8 /* Comment */) {
      if (fromNode && fromNode.nodeType === 8) {
        fi++
      } else {
        from.insertBefore(document.createComment(toNode.nodeValue ?? ""), fromNode ?? null)
        fi++
      }
      continue
    }

    if (toNode.nodeType !== 1) continue
    const toEl = toNode as Element

    // try id match
    if (toEl.id && fromById.has(toEl.id)) {
      const keyed = fromById.get(toEl.id)!
      if (keyed !== fromNode) {
        from.insertBefore(keyed, fromNode ?? null)
      }
      morphElement(keyed, toEl)
      fi++
      continue
    }

    if (
      fromNode &&
      fromNode.nodeType === 1 &&
      (fromNode as Element).nodeName === toEl.nodeName
    ) {
      morphElement(fromNode as Element, toEl)
      fi++
    } else {
      const clone = toEl.cloneNode(false) as Element
      copyAttrs(clone, toEl)
      // deep: morph empty clone with toEl children by replacing
      clone.innerHTML = toEl.innerHTML
      // Better: recursive
      morphChildren(clone, toEl)
      from.insertBefore(clone, fromNode ?? null)
      // copy attributes already done; re-morph properly
      morphElement(clone, toEl)
      fi++
    }
  }

  // remove extras
  while (from.childNodes.length > toNodes.length) {
    from.removeChild(from.lastChild!)
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
