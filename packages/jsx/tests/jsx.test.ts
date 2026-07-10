import { describe, expect, it } from "vitest"
import { jsx, jsxs, jsxDEV, Fragment, h } from "../src/index.js"
import { renderToString } from "potato-train-core"

describe("jsx runtime", () => {
  it("jsx/jsxs/jsxDEV", () => {
    const a = jsx("div", { class: "a", children: "x" }, "k")
    expect(a.key).toBe("k")
    const b = jsxs("div", { children: ["a", "b"] })
    expect(renderToString(b)).toContain("a")
    const c = jsxDEV("span", { children: "d" })
    expect(renderToString(c)).toBe("<span>d</span>")
  })

  it("exports h and Fragment", () => {
    expect(typeof h).toBe("function")
    expect(Fragment).toBeDefined()
  })
})
