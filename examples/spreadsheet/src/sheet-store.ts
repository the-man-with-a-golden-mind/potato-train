import { createSheetEngine, cellKey, indexToColLetters } from "potato-train-formula"
import type { CellValue } from "potato-train-formula"

/** In-memory sheet backend with incremental formula engine. */
export interface SheetMeta {
  id: string
  name: string
  rows: number
  cols: number
}

export interface SheetData {
  meta: SheetMeta
  raw: Record<string, string>
  values: Record<string, CellValue>
  updatedAt: number
}

const engines = new Map<string, ReturnType<typeof createSheetEngine>>()
const metas = new Map<string, SheetMeta>()

function seedDemo(): SheetData {
  // Row 0 is headers in-grid; data rows 1+ like Excel
  const raw: Record<string, string> = {
    A1: "Item",
    B1: "Qty",
    C1: "Price",
    D1: "Total",
    E1: "Category",
    A2: "Widgets",
    B2: "10",
    C2: "4.5",
    D2: "=B2*C2",
    E2: "Parts",
    A3: "Gadgets",
    B3: "3",
    C3: "12",
    D3: "=B3*C3",
    E3: "Parts",
    A4: "Sprockets",
    B4: "25",
    C4: "1.2",
    D4: "=B4*C4",
    E4: "Parts",
    A6: "Subtotal",
    D6: "=SUM(D2:D4)",
    A7: "Tax 8%",
    D7: "=D6*0.08",
    A8: "Grand",
    D8: "=D6+D7",
    F1: "Note",
    F2: '=IF(D6>100,"Big order","Small")',
  }

  // Dense-ish sample so scrolling shows content (not empty desert)
  for (let r = 10; r < 500; r++) {
    raw[`A${r + 1}`] = `Item ${r}`
    raw[`B${r + 1}`] = String((r % 20) + 1)
    raw[`C${r + 1}`] = String(((r * 7) % 50) + 0.5)
    raw[`D${r + 1}`] = `=B${r + 1}*C${r + 1}`
    raw[`E${r + 1}`] = r % 2 === 0 ? "Parts" : "Misc"
  }
  // Sparse markers deeper in the sheet
  for (let r = 1000; r < 50_000; r += 500) {
    raw[`A${r + 1}`] = `Marker row ${r + 1}`
    raw[`B${r + 1}`] = String(r)
    raw[`C${r + 1}`] = "1"
    raw[`D${r + 1}`] = `=B${r + 1}*C${r + 1}`
  }

  const meta: SheetMeta = {
    id: "demo",
    name: "Orders",
    rows: 50_000,
    cols: 26,
  }
  const eng = createSheetEngine(raw)
  engines.set(meta.id, eng)
  metas.set(meta.id, meta)
  return toData(meta.id)
}

function toData(id: string): SheetData {
  const eng = engines.get(id)!
  const meta = metas.get(id)!
  return {
    meta,
    raw: eng.raw,
    values: eng.values,
    updatedAt: Date.now(),
  }
}

export function getSheet(id = "demo"): SheetData {
  if (!engines.has(id)) seedDemo()
  return toData(id)
}

export function setCell(id: string, key: string, value: string): SheetData {
  getSheet(id)
  engines.get(id)!.setCell(key, value)
  return toData(id)
}

export function setCells(
  id: string,
  updates: Record<string, string>,
): SheetData {
  getSheet(id)
  engines.get(id)!.setCells(updates)
  return toData(id)
}

export function getWindow(
  id: string,
  rowStart: number,
  rowCount: number,
  colStart = 0,
  colCount = 10,
): {
  meta: SheetMeta
  rowStart: number
  colStart: number
  headers: string[]
  rows: Array<{
    row: number
    cells: Array<{ key: string; raw: string; value: CellValue }>
  }>
  updatedAt: number
} {
  const sheet = getSheet(id)
  const eng = engines.get(id)!
  const headers = Array.from({ length: colCount }, (_, i) =>
    indexToColLetters(colStart + i),
  )
  const rows = []
  for (let r = 0; r < rowCount; r++) {
    const row = rowStart + r
    if (row >= sheet.meta.rows) break
    const cells = []
    for (let c = 0; c < colCount; c++) {
      const col = colStart + c
      const key = cellKey(col, row)
      cells.push({
        key,
        raw: eng.raw[key] ?? "",
        value: eng.getValue(key),
      })
    }
    rows.push({ row, cells })
  }
  return {
    meta: sheet.meta,
    rowStart,
    colStart,
    headers,
    rows,
    updatedAt: Date.now(),
  }
}

export function ensureHugeSample(id = "demo"): void {
  // seedDemo already fills dense + sparse data
  getSheet(id)
}
