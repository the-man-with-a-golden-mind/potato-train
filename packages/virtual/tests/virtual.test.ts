import { describe, expect, it } from "vitest"
import {
  computeWindow,
  computeGridWindow,
  totalHeight,
  sliceWindow,
} from "../src/index.js"

describe("computeWindow", () => {
  it("windows a huge list", () => {
    const win = computeWindow(0, 400, {
      rowHeight: 20,
      totalRows: 50_000,
      overscan: 2,
    })
    expect(win.start).toBe(0)
    expect(win.visibleCount).toBeLessThan(50)
    expect(win.totalHeight).toBe(50_000 * 20)
    expect(win.end).toBe(win.start + win.visibleCount)
  })

  it("scrolls mid-list", () => {
    const win = computeWindow(20_000, 400, {
      rowHeight: 20,
      totalRows: 50_000,
      overscan: 0,
    })
    expect(win.start).toBe(1000)
    expect(win.offsetY).toBe(20_000)
  })

  it("clamps at end", () => {
    const win = computeWindow(999_999, 200, {
      rowHeight: 10,
      totalRows: 100,
      overscan: 5,
    })
    expect(win.end).toBe(100)
    expect(win.start).toBeLessThan(win.end)
  })
})

describe("grid + slice", () => {
  it("computes 2d window", () => {
    const g = computeGridWindow(0, 100, 300, 400, {
      rowHeight: 24,
      colWidth: 80,
      totalRows: 1000,
      totalCols: 26,
      overscan: 1,
      overscanCols: 1,
    })
    expect(g.colStart).toBeGreaterThanOrEqual(0)
    expect(g.totalWidth).toBe(26 * 80)
  })

  it("slices arrays", () => {
    const items = [0, 1, 2, 3, 4, 5]
    const win = computeWindow(0, 40, {
      rowHeight: 20,
      totalRows: 6,
      overscan: 0,
    })
    expect(sliceWindow(items, win).length).toBe(win.visibleCount)
  })

  it("totalHeight", () => {
    expect(totalHeight({ totalRows: 10, rowHeight: 5 })).toBe(50)
  })
})
