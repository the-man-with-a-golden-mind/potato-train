import { describe, expect, it } from "vitest"
import {
  evaluate,
  evaluateSheet,
  cellKey,
  createSheetEngine,
  FormulaError,
  parseRef,
} from "../src/index.js"

const empty = () => null

describe("formula edges", () => {
  it("comparisons concat round abs count if", () => {
    const grid: Record<string, number | string> = { A1: 5, A2: 2, B1: "x" }
    const get = (c: number, r: number) =>
      grid[cellKey(c, r)] ?? null
    expect(evaluate("=A1>A2", get)).toBe(true)
    expect(evaluate("=A1<A2", get)).toBe(false)
    expect(evaluate("=A1>=5", get)).toBe(true)
    expect(evaluate("=A1<=4", get)).toBe(false)
    expect(evaluate("=A1=5", get)).toBe(true)
    expect(evaluate("=A1<>2", get)).toBe(true)
    expect(evaluate("=CONCAT(B1,\"y\")", get)).toBe("xy")
    expect(evaluate("=ABS(-3)", get)).toBe(3)
    expect(evaluate("=ROUND(1.234,2)", get)).toBe(1.23)
    expect(evaluate("=COUNT(A1:A2)", get)).toBe(2)
    expect(evaluate("=1-2", get)).toBe(-1)
    expect(evaluate("=+(5)", get)).toBe(5)
    expect(evaluate('="hi"', get)).toBe("hi")
    expect(evaluate(null, get)).toBeNull()
    expect(evaluate(true, get)).toBe(true)
    expect(evaluate("", get)).toBeNull()
  })

  it("unknown function and circular", () => {
    expect(String(evaluate("=NOPE()", empty))).toContain("ERR")
    const sheet = evaluateSheet({ A1: "=A2", A2: "=A1" })
    expect(String(sheet.A1)).toMatch(/ERR|circular/i)
  })

  it("parseRef errors", () => {
    expect(() => parseRef("%%")).toThrow(FormulaError)
  })

  it("engine recomputeAll and empty cell", () => {
    const eng = createSheetEngine({ A1: "1", A2: "=A1" })
    eng.recomputeAll()
    eng.setCell("A1", "")
    expect(eng.getValue("ZZ99")).toBeNull()
    eng.setCells({ B1: "2", B2: "=B1*3" })
    expect(eng.getValue("B2")).toBe(6)
  })
})
