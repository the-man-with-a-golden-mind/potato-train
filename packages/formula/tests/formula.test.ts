import { describe, expect, it } from "vitest"
import {
  evaluate,
  evaluateSheet,
  parseRef,
  cellKey,
  indexToColLetters,
  colLettersToIndex,
} from "../src/index.js"

describe("refs", () => {
  it("parses A1 style", () => {
    expect(parseRef("A1")).toEqual({ col: 0, row: 0 })
    expect(parseRef("B10")).toEqual({ col: 1, row: 9 })
    expect(parseRef("AA2")).toEqual({ col: 26, row: 1 })
  })

  it("roundtrips col letters", () => {
    expect(indexToColLetters(0)).toBe("A")
    expect(indexToColLetters(25)).toBe("Z")
    expect(indexToColLetters(26)).toBe("AA")
    expect(colLettersToIndex("AA")).toBe(26)
    expect(cellKey(1, 2)).toBe("B3")
  })
})

describe("evaluate", () => {
  const grid: Record<string, number | string> = {
    A1: 10,
    A2: 20,
    B1: 5,
  }
  const get = (c: number, r: number) => {
    const key = cellKey(c, r)
    return grid[key] ?? null
  }

  it("literals", () => {
    expect(evaluate("42", get)).toBe(42)
    expect(evaluate("hello", get)).toBe("hello")
  })

  it("arithmetic", () => {
    expect(evaluate("=1+2*3", get)).toBe(7)
    expect(evaluate("=(1+2)*3", get)).toBe(9)
    expect(evaluate("=2^3", get)).toBe(8)
  })

  it("cell refs", () => {
    expect(evaluate("=A1+A2", get)).toBe(30)
    expect(evaluate("=A1*B1", get)).toBe(50)
  })

  it("SUM range", () => {
    expect(evaluate("=SUM(A1:A2)", get)).toBe(30)
  })

  it("IF", () => {
    expect(evaluate('=IF(A1>5,"big","small")', get)).toBe("big")
    expect(evaluate('=IF(A1<5,"big","small")', get)).toBe("small")
  })

  it("AVG MIN MAX", () => {
    expect(evaluate("=AVG(A1:A2)", get)).toBe(15)
    expect(evaluate("=MIN(A1:A2)", get)).toBe(10)
    expect(evaluate("=MAX(A1:A2)", get)).toBe(20)
  })

  it("div zero", () => {
    expect(String(evaluate("=1/0", get))).toContain("ERR")
  })
})

describe("evaluateSheet", () => {
  it("resolves dependent formulas", () => {
    const raw = {
      A1: "10",
      A2: "20",
      A3: "=SUM(A1:A2)",
      B1: "=A3*2",
    }
    const out = evaluateSheet(raw)
    expect(out.A3).toBe(30)
    expect(out.B1).toBe(60)
  })
})
