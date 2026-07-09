import { cellKey, parseRef } from "@potato/formula"
import type { Row, SheetSlice } from "./types.js"
import { DEFAULT_COL_W, MIN_COL_W, ROW_HEAD_W } from "./constants.js"

export function colW(state: SheetSlice, header: string): number {
  return state.colWidths[header] ?? DEFAULT_COL_W
}

export function tableWidth(state: SheetSlice): number {
  return ROW_HEAD_W + state.headers.reduce((n, h) => n + colW(state, h), 0)
}

export function findCellRaw(rows: Row[], key: string): string | null {
  const k = key.toUpperCase()
  for (const row of rows) {
    for (const c of row.cells) {
      if (c.key === k) return c.raw ?? ""
    }
  }
  return null
}

export function findCellValue(
  rows: Row[],
  key: string,
): string | number | boolean | null | undefined {
  const k = key.toUpperCase()
  for (const row of rows) {
    for (const c of row.cells) {
      if (c.key === k) return c.value
    }
  }
  return undefined
}

/** Neighbor cell key clamped to sheet bounds */
export function moveKey(
  key: string,
  dCol: number,
  dRow: number,
  totalCols: number,
  totalRows: number,
): string {
  try {
    const { col, row } = parseRef(key)
    const nc = Math.max(0, Math.min(totalCols - 1, col + dCol))
    const nr = Math.max(0, Math.min(totalRows - 1, row + dRow))
    return cellKey(nc, nr)
  } catch {
    return key.toUpperCase()
  }
}

export function clampColWidth(w: number): number {
  return Math.max(MIN_COL_W, Math.round(w))
}

export function focusEditor(value: string) {
  if (typeof document === "undefined") return
  requestAnimationFrame(() => {
    const cellIn = document.querySelector(
      ".cell-input",
    ) as HTMLInputElement | null
    const bar = document.querySelector(
      ".formula-input",
    ) as HTMLInputElement | null
    const target = cellIn ?? bar
    if (!target) return
    if (document.activeElement !== target || target.value !== value) {
      target.value = value
    }
    if (bar && bar !== target) bar.value = value
    target.focus()
    target.select()
  })
}

export function restoreScroll(scrollTop: number, scrollLeft: number) {
  if (typeof document === "undefined") return
  requestAnimationFrame(() => {
    const vp = document.querySelector(".grid-scroll") as HTMLElement | null
    if (!vp) return
    if (Math.abs(vp.scrollTop - scrollTop) > 1) vp.scrollTop = scrollTop
    if (Math.abs(vp.scrollLeft - scrollLeft) > 1) vp.scrollLeft = scrollLeft
  })
}

/** Ensure selected cell is inside the vertical viewport */
export function scrollToKey(
  key: string,
  state: SheetSlice,
): { scrollTop: number } | null {
  try {
    const { row } = parseRef(key)
    const y = row * state.rowHeight
    const bodyH = Math.max(80, state.viewportH - state.headerH)
    let scrollTop = state.scrollTop
    if (y < scrollTop) scrollTop = y
    else if (y + state.rowHeight > scrollTop + bodyH) {
      scrollTop = y + state.rowHeight - bodyH
    }
    if (scrollTop === state.scrollTop) return null
    return { scrollTop: Math.max(0, scrollTop) }
  } catch {
    return null
  }
}
