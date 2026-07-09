import type { Row } from "./types.js"

export async function apiWindow(
  sheetId: string,
  rowStart: number,
  rowCount: number,
  colStart: number,
  colCount: number,
) {
  const q = new URLSearchParams({
    rowStart: String(rowStart),
    rowCount: String(rowCount),
    colStart: String(colStart),
    colCount: String(colCount),
  })
  const res = await fetch(`/api/sheets/${sheetId}/window?${q}`)
  if (!res.ok) throw new Error(`window ${res.status}`)
  return (await res.json()) as {
    meta: { rows: number; cols: number; name: string }
    headers: string[]
    rows: Row[]
  }
}

export async function apiCell(sheetId: string, key: string) {
  const res = await fetch(
    `/api/sheets/${sheetId}/cells/${encodeURIComponent(key)}`,
  )
  if (!res.ok) throw new Error(`cell ${res.status}`)
  return (await res.json()) as { key: string; raw: string; value: unknown }
}

export async function apiPatch(sheetId: string, key: string, value: string) {
  const res = await fetch(
    `/api/sheets/${sheetId}/cells/${encodeURIComponent(key)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value }),
    },
  )
  if (!res.ok) throw new Error(`patch ${res.status}`)
  return (await res.json()) as { key: string; raw: string; value: unknown }
}
