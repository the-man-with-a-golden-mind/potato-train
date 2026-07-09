import { describe, expect, it } from "vitest"
import {
  createSheetEngine,
  collectDependencies,
  dirtyClosure,
  rebuildGraph,
} from "../src/index.js"

describe("dependency graph", () => {
  it("collects refs and ranges", () => {
    expect([...collectDependencies("=A1+B2")].sort()).toEqual(["A1", "B2"])
    const range = collectDependencies("=SUM(A1:A3)")
    expect(range.has("A1")).toBe(true)
    expect(range.has("A2")).toBe(true)
    expect(range.has("A3")).toBe(true)
  })

  it("dirtyClosure follows dependents", () => {
    const g = rebuildGraph({
      A1: "1",
      A2: "=A1*2",
      A3: "=A2+1",
      B1: "9",
    })
    const dirty = dirtyClosure(g, ["A1"])
    expect(dirty.has("A1")).toBe(true)
    expect(dirty.has("A2")).toBe(true)
    expect(dirty.has("A3")).toBe(true)
    expect(dirty.has("B1")).toBe(false)
  })
})

describe("createSheetEngine incremental", () => {
  it("only dirties dependents on setCell", () => {
    const eng = createSheetEngine({
      A1: "10",
      A2: "=A1*2",
      A3: "=A2+5",
      Z9: "100",
    })
    expect(eng.getValue("A3")).toBe(25)

    const dirty = eng.setCell("A1", "20")
    expect(eng.getValue("A2")).toBe(40)
    expect(eng.getValue("A3")).toBe(45)
    expect(dirty).toContain("A1")
    expect(dirty).toContain("A2")
    expect(dirty).toContain("A3")
    expect(dirty).not.toContain("Z9")
    expect(eng.getValue("Z9")).toBe(100)
  })
})
