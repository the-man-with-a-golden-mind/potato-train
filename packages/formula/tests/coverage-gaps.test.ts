import { describe, expect, it } from "vitest"
import {
  evaluate,
  cellKey,
  createSheetEngine,
  createDepGraph,
  unlinkAllDeps,
  linkDep,
  collectDependencies,
  rebuildGraph,
  dirtyClosure,
  indexToColLetters,
  colLettersToIndex,
  parseRef,
} from "../src/index.js"

describe("formula coverage", () => {
  it("string concat binary +", () => {
    expect(evaluate('="a"+"b"', () => null)).toBe("ab")
  })

  it("unknown op via broken path covered by err", () => {
    expect(String(evaluate("=1/0", () => null))).toContain("ERR")
  })

  it("IF without branches", () => {
    expect(evaluate("=IF(1)", () => null)).toBe(true)
    expect(evaluate("=IF(0)", () => null)).toBe(false)
  })

  it("AVERAGE alias MIN empty", () => {
    expect(evaluate("=AVERAGE()", () => null)).toBe(0)
    expect(evaluate("=MIN()", () => null)).toBe(0)
    expect(evaluate("=MAX()", () => null)).toBe(0)
  })

  it("col letters AA", () => {
    expect(indexToColLetters(26)).toBe("AA")
    expect(colLettersToIndex("AA")).toBe(26)
    expect(cellKey(0, 0)).toBe("A1")
    expect(() => parseRef("A0")).toThrow()
  })


  it("unlink deps on empty graph", () => {
    const g = createDepGraph()
    unlinkAllDeps(g, "A1")
    linkDep(g, "A2", "A1")
    unlinkAllDeps(g, "A2")
    expect(dirtyClosure(g, []).size).toBe(0)
    expect(rebuildGraph({}).deps.size).toBe(0)
    expect(collectDependencies("10").size).toBe(0)
  })

  it("engine set empty and recompute", () => {
    const e = createSheetEngine({ A1: "1", A2: "=A1" })
    e.setCell("A2", "")
    e.recomputeAll()
    e.setCells({})
  })

  it("range outside function errors", () => {
    expect(String(evaluate("=A1:A2", () => 1))).toContain("ERR")
  })

  it("unary minus and power", () => {
    expect(evaluate("=2^3", () => null)).toBe(8)
    expect(evaluate("=-5", () => null)).toBe(-5)
  })
})

