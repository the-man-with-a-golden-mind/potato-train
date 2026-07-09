import type { VirtualWindow } from "@potato/virtual"

export type Cell = {
  key: string
  raw: string
  value: string | number | boolean | null
}

export type Row = {
  row: number
  cells: Cell[]
}

/** Feature state slice (also full app State for this example) */
export type SheetSlice = {
  sheetId: string
  scrollTop: number
  scrollLeft: number
  viewportH: number
  viewportW: number
  rowHeight: number
  headerH: number
  colStart: number
  colCount: number
  colWidths: Record<string, number>
  window: VirtualWindow
  rows: Row[]
  headers: string[]
  totalRows: number
  totalCols: number
  selected: string | null
  editing: string | null
  editValue: string
  status: string
  busy: boolean
  resizeCol: string | null
}

/** App state = feature slice (createApp adds core fields) */
export type SheetState = SheetSlice

/**
 * Typed intent catalog — rename a key → tsc lists every emit/on site.
 * No grep.
 */
export type SheetEvents = {
  "sheet:scroll": [{ top: number; left: number }]
  "sheet:select": [key: string]
  "sheet:edit-start": [key: string]
  "sheet:edit-change": [value: string]
  "sheet:edit-commit": [opts?: { move?: "down" | "right" | "none" }]
  "sheet:edit-cancel": []
  "sheet:clear": []
  "sheet:move": [{ dCol: number; dRow: number }]
  "sheet:resize-start": [col: string]
  "sheet:resize-move": [{ col: string; width: number }]
  "sheet:resize-end": []
  "sheet:refresh": []
  "sheet:viewport": [{ h: number; w?: number } | number]
}
