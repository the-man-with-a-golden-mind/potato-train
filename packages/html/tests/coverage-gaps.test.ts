import { describe, expect, it } from "vitest"
import { html, raw } from "../src/index.js"
import { h, renderToString } from "@potato/core"

describe("html coverage", () => {
  it("nested tags and attrs variants", () => {
    const tree = html`<div id="a" class='b' data-x=y><span>s</span></div>`
    expect(renderToString(tree)).toContain("span")
  })

  it("array children interpolation", () => {
    const kids = [h("i", null, "1"), h("i", null, "2")]
    const tree = html`<div>${kids}</div>`
    expect(renderToString(tree)).toContain("1")
  })

  it("fallback raw parse", () => {
    const tree = html`not-a-tag ${1}`
    expect(renderToString(tree)).toBeTruthy()
  })

  it("boolean attr empty", () => {
    const tree = html`<input disabled />`
    expect(tree.type).toBe("input")
  })

  it("raw export", () => {
    expect(raw("<z></z>").props.dangerouslySetInnerHTML).toBeTruthy()
  })
})
