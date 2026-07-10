import { describe, expect, it } from "vitest"
import { html, raw, h } from "../src/index.js"
import { renderToString } from "potato-train-core"

describe("html tagged template", () => {
  it("parses simple element", () => {
    const tree = html`<div class="x">hi</div>`
    expect(renderToString(tree)).toContain("hi")
    expect(renderToString(tree)).toContain('class="x"')
  })

  it("interpolates values and children", () => {
    const child = h("span", null, "c")
    const tree = html`<p>${child} ${1}</p>`
    expect(renderToString(tree)).toContain("c")
  })

  it("functions as handlers placeholders", () => {
    const fn = () => {}
    const tree = html`<button onclick=${fn}>ok</button>`
    expect(tree.props.onclick).toBe(fn)
  })

  it("self closing", () => {
    const tree = html`<img src="a.png" />`
    expect(renderToString(tree)).toContain("img")
  })

  it("raw helper", () => {
    const tree = raw("<b>x</b>")
    expect(renderToString(tree)).toContain("<b>x</b>")
  })

  it("falsey interpolations skip", () => {
    const tree = html`<div>${null}${false}${undefined}z</div>`
    expect(renderToString(tree)).toContain("z")
  })
})
