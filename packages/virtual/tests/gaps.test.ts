import { describe, expect, it } from "vitest"
import {
  rowAtOffset,
  computeWindow,
  computeGridWindow,
  sliceWindow,
} from "../src/index.js"

describe("virtual gaps", () => {
  it("rowAtOffset", () => {
    expect(rowAtOffset(50, 10)).toBe(5)
    expect(rowAtOffset(-1, 10)).toBe(0)
  })

  it("overscan default", () => {
    const w = computeWindow(0, 100, { rowHeight: 10, totalRows: 1000 })
    expect(w.visibleCount).toBeGreaterThan(10)
    expect(sliceWindow([1, 2, 3, 4, 5], w).length).toBeLessThanOrEqual(5)
  })

  it("grid window clamps columns", () => {
    const g = computeGridWindow(0, 5000, 200, 100, {
      rowHeight: 20,
      colWidth: 50,
      totalRows: 100,
      totalCols: 5,
      overscanCols: 1,
    })
    expect(g.colEnd).toBeLessThanOrEqual(5)
    expect(g.colStart).toBeGreaterThanOrEqual(0)
    const g2 = computeGridWindow(0, 0, 200, 100, {
      rowHeight: 20,
      colWidth: 50,
      totalRows: 10,
      totalCols: 3,
    })
    expect(g2.colStart).toBe(0)
  })
})

