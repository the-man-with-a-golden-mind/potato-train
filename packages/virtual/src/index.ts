/**
 * Virtual windowing for huge lists and grids.
 * Keep DOM O(viewport); data can be 10k–1M rows.
 */

export interface VirtualConfig {
  rowHeight: number
  overscan?: number
  totalRows: number
}

export interface VirtualWindow {
  /** Inclusive start row index */
  start: number
  /** Exclusive end row index */
  end: number
  /** CSS translateY for the windowed content */
  offsetY: number
  /** Number of rows in the window */
  visibleCount: number
  /** Total scroll height */
  totalHeight: number
}

export function computeWindow(
  scrollTop: number,
  viewportHeight: number,
  cfg: VirtualConfig,
): VirtualWindow {
  const rowHeight = cfg.rowHeight
  const overscan = cfg.overscan ?? 5
  const totalRows = cfg.totalRows
  const totalHeight = totalRows * rowHeight

  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2
  let start = Math.floor(scrollTop / rowHeight) - overscan
  if (start < 0) start = 0
  let end = start + visibleCount
  if (end > totalRows) end = totalRows
  start = Math.max(0, Math.min(start, Math.max(0, end - visibleCount)))

  return {
    start,
    end,
    offsetY: start * rowHeight,
    visibleCount: end - start,
    totalHeight,
  }
}

export function totalHeight(cfg: Pick<VirtualConfig, "totalRows" | "rowHeight">): number {
  return cfg.totalRows * cfg.rowHeight
}

/** Map a pixel Y to a row index */
export function rowAtOffset(scrollTop: number, rowHeight: number): number {
  return Math.max(0, Math.floor(scrollTop / rowHeight))
}

export interface GridWindowConfig extends VirtualConfig {
  colWidth: number
  totalCols: number
  overscanCols?: number
}

export interface GridWindow extends VirtualWindow {
  colStart: number
  colEnd: number
  offsetX: number
  totalWidth: number
}

/** 2D window for virtual grids (spreadsheets). */
export function computeGridWindow(
  scrollTop: number,
  scrollLeft: number,
  viewportHeight: number,
  viewportWidth: number,
  cfg: GridWindowConfig,
): GridWindow {
  const row = computeWindow(scrollTop, viewportHeight, cfg)
  const overscanCols = cfg.overscanCols ?? 2
  const totalWidth = cfg.totalCols * cfg.colWidth
  const visibleCols =
    Math.ceil(viewportWidth / cfg.colWidth) + overscanCols * 2
  let colStart = Math.floor(scrollLeft / cfg.colWidth) - overscanCols
  if (colStart < 0) colStart = 0
  let colEnd = colStart + visibleCols
  if (colEnd > cfg.totalCols) colEnd = cfg.totalCols
  colStart = Math.max(0, Math.min(colStart, Math.max(0, colEnd - visibleCols)))

  return {
    ...row,
    colStart,
    colEnd,
    offsetX: colStart * cfg.colWidth,
    totalWidth,
  }
}

/** Slice an array for the current window */
export function sliceWindow<T>(items: readonly T[], win: VirtualWindow): T[] {
  return items.slice(win.start, win.end) as T[]
}
