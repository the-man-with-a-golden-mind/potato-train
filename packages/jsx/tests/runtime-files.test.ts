import { describe, expect, it } from "vitest"
import * as runtime from "../src/jsx-runtime.js"
import * as dev from "../src/jsx-dev-runtime.js"

describe("jsx entry re-exports", () => {
  it("loads jsx-runtime and jsx-dev-runtime", () => {
    expect(runtime.jsx).toBeTypeOf("function")
    expect(dev.jsxDEV).toBeTypeOf("function")
    expect(runtime.Fragment).toBeDefined()
  })
})
