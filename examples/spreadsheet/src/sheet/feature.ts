/**
 * Sheet feature — defineFeature wraps store logic with typed Events.
 */
import { defineFeature } from "@potato/core"
import { computeWindow, type VirtualWindow } from "@potato/virtual"
import { apiCell, apiPatch, apiWindow } from "./api.js"
import {
  DEFAULT_COLS,
  DEFAULT_ROWS,
  HEADER_H,
  OVERSCAN,
  ROW_H,
} from "./constants.js"
import {
  clampColWidth,
  findCellRaw,
  focusEditor,
  moveKey,
  restoreScroll,
  scrollToKey,
} from "./helpers.js"
import type { SheetEvents, SheetSlice } from "./types.js"

const emptyWin: VirtualWindow = {
  start: 0,
  end: 0,
  offsetY: 0,
  visibleCount: 0,
  totalHeight: 0,
}

export const initialSheet: SheetSlice = {
  sheetId: "demo",
  scrollTop: 0,
  scrollLeft: 0,
  viewportH: 600,
  viewportW: 900,
  rowHeight: ROW_H,
  headerH: HEADER_H,
  colStart: 0,
  colCount: DEFAULT_COLS,
  colWidths: {},
  window: emptyWin,
  rows: [],
  headers: [],
  totalRows: DEFAULT_ROWS,
  totalCols: 26,
  selected: null,
  editing: null,
  editValue: "",
  status: "Loading…",
  busy: false,
  resizeCol: null,
}

export const sheetFeature = defineFeature<SheetSlice, SheetEvents>({
  name: "sheet",
  state: initialSheet,
  setup: ({ set, patch, on, emit, get }) => {
    let scrollTimer: ReturnType<typeof setTimeout> | null = null
    let lastFetchKey = ""
    let fetchGen = 0

    async function refreshWindow(opts?: {
      scrollTop?: number
      scrollLeft?: number
      viewportH?: number
      force?: boolean
    }) {
      const s = get()
      const scrollTop = opts?.scrollTop ?? s.scrollTop
      const scrollLeft = opts?.scrollLeft ?? s.scrollLeft
      const viewportH = opts?.viewportH ?? s.viewportH
      const bodyH = Math.max(80, viewportH - s.headerH)
      const vw = computeWindow(scrollTop, bodyH, {
        rowHeight: s.rowHeight,
        overscan: OVERSCAN,
        totalRows: s.totalRows,
      })
      const fetchKey = `${vw.start}:${vw.end}:${s.colStart}:${s.colCount}`

      if (fetchKey === lastFetchKey && !opts?.force && s.rows.length > 0) {
        set({ scrollTop, scrollLeft, viewportH })
        return
      }

      const gen = ++fetchGen
      try {
        const data = await apiWindow(
          s.sheetId,
          vw.start,
          Math.max(1, vw.end - vw.start),
          s.colStart,
          s.colCount,
        )
        if (gen !== fetchGen) return

        lastFetchKey = fetchKey
        const totalRows = data.meta.rows
        const cur = get()
        set({
          scrollTop,
          scrollLeft,
          viewportH,
          window: {
            ...vw,
            totalHeight: totalRows * s.rowHeight,
          },
          rows: data.rows,
          headers: data.headers,
          totalRows,
          totalCols: data.meta.cols,
          status: cur.editing
            ? cur.status
            : `${data.meta.name} · ${totalRows.toLocaleString()} rows × ${data.meta.cols} cols · click select · double-click / F2 edit · arrows move`,
          busy: false,
        })
        emit("render")
        restoreScroll(scrollTop, scrollLeft)
      } catch (e) {
        if (gen !== fetchGen) return
        patch({
          status: `Error: ${e instanceof Error ? e.message : String(e)}`,
          busy: false,
        })
      }
    }

    async function selectCell(key: string, opts?: { edit?: boolean }) {
      const s = get()
      const k = key.toUpperCase()
      const local = findCellRaw(s.rows, k)
      const immediate = local ?? ""

      if (opts?.edit) {
        patch({
          selected: k,
          editing: k,
          editValue: immediate,
          status: `Editing ${k}${immediate.startsWith("=") ? " (formula)" : ""} — Enter save · Esc cancel`,
        })
        focusEditor(immediate)
      } else {
        patch({
          selected: k,
          editing: null,
          editValue: immediate,
          status: `Selected ${k}`,
        })
      }

      const scrollAdj = scrollToKey(k, { ...get() })
      if (scrollAdj) {
        set(scrollAdj)
        const vp = document.querySelector(".grid-scroll") as HTMLElement | null
        if (vp) vp.scrollTop = scrollAdj.scrollTop
        void refreshWindow({ scrollTop: scrollAdj.scrollTop })
      }

      try {
        const remote = await apiCell(s.sheetId, k)
        const cur = get()
        if (cur.selected !== k && cur.editing !== k) return
        const raw = remote.raw ?? ""
        if (cur.editing === k) {
          if (cur.editValue === immediate || cur.editValue === "") {
            patch({
              editValue: raw,
              status: `Editing ${k}${raw.startsWith("=") ? " (formula)" : ""} — Enter save · Esc cancel`,
            })
            focusEditor(raw)
          }
        } else if (cur.selected === k && !cur.editing) {
          set({ editValue: raw })
          emit("render")
          const bar = document.querySelector(
            ".formula-input",
          ) as HTMLInputElement | null
          if (bar && document.activeElement !== bar) bar.value = raw
        }
      } catch {
        /* keep local */
      }
    }

    void refreshWindow()

    if (typeof window !== "undefined") {
      const measure = () => {
        const vp = document.querySelector(".grid-scroll") as HTMLElement | null
        if (!vp) return
        const h = vp.clientHeight
        const w = vp.clientWidth
        if (h > 40) {
          lastFetchKey = ""
          void refreshWindow({ viewportH: h })
          set({ viewportW: w || 900 })
        }
      }
      queueMicrotask(measure)
      window.addEventListener("resize", () => {
        lastFetchKey = ""
        measure()
      })
    }

    on("sheet:scroll", (payload) => {
      const top = Math.max(0, Number(payload.top) || 0)
      const left = Math.max(0, Number(payload.left) || 0)
      set({ scrollTop: top, scrollLeft: left })
      if (scrollTimer) clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => {
        void refreshWindow({ scrollTop: top, scrollLeft: left })
      }, 16)
    })

    on("sheet:select", (key) => {
      void selectCell(String(key), { edit: false })
    })

    on("sheet:edit-start", (key) => {
      void selectCell(String(key), { edit: true })
    })

    on("sheet:edit-change", (value) => {
      const v = String(value ?? "")
      set({ editValue: v })
      const bar = document.querySelector(
        ".formula-input",
      ) as HTMLInputElement | null
      const cell = document.querySelector(
        ".cell-input",
      ) as HTMLInputElement | null
      if (bar && document.activeElement !== bar) bar.value = v
      if (cell && document.activeElement !== cell) cell.value = v
    })

    on("sheet:edit-cancel", () => {
      const s = get()
      const local = s.selected ? findCellRaw(s.rows, s.selected) : ""
      patch({
        editing: null,
        editValue: local ?? "",
        status: s.selected ? `Selected ${s.selected}` : "Edit cancelled",
      })
    })

    on("sheet:edit-commit", async (opts) => {
      const s = get()
      if (!s.editing || s.busy) return
      const key = s.editing
      const move = opts?.move ?? "none"
      const dom =
        (document.querySelector(".cell-input") as HTMLInputElement | null) ||
        (document.querySelector(".formula-input") as HTMLInputElement | null)
      const value = dom?.value ?? s.editValue
      patch({ busy: true, status: `Saving ${key}…`, editValue: value })
      try {
        const result = await apiPatch(s.sheetId, key, value)
        lastFetchKey = ""
        set({
          editing: null,
          selected: key,
          editValue: result.raw ?? value,
          busy: false,
        })
        await refreshWindow({ force: true })
        set({
          status: `Saved ${key} = ${result.raw || String(result.value)}`,
        })
        emit("render")

        if (move === "down" || move === "right") {
          const next = moveKey(
            key,
            move === "right" ? 1 : 0,
            move === "down" ? 1 : 0,
            get().totalCols,
            get().totalRows,
          )
          void selectCell(next, { edit: false })
        }
      } catch (e) {
        patch({
          busy: false,
          status: `Save failed: ${e instanceof Error ? e.message : String(e)}`,
        })
      }
    })

    on("sheet:clear", async () => {
      const s = get()
      if (!s.selected || s.busy || s.editing) return
      const key = s.selected
      patch({ busy: true, status: `Clearing ${key}…` })
      try {
        await apiPatch(s.sheetId, key, "")
        lastFetchKey = ""
        set({ editValue: "", busy: false })
        await refreshWindow({ force: true })
        patch({ status: `Cleared ${key}`, selected: key, editValue: "" })
      } catch (e) {
        patch({
          busy: false,
          status: `Clear failed: ${e instanceof Error ? e.message : String(e)}`,
        })
      }
    })

    on("sheet:move", (payload) => {
      const s = get()
      if (s.editing) return
      const from = s.selected ?? "A1"
      const next = moveKey(
        from,
        payload.dCol || 0,
        payload.dRow || 0,
        s.totalCols,
        s.totalRows,
      )
      void selectCell(next, { edit: false })
    })

    on("sheet:resize-start", (col) => {
      set({ resizeCol: String(col) })
    })

    on("sheet:resize-move", (payload) => {
      const s = get()
      patch({
        colWidths: {
          ...s.colWidths,
          [payload.col]: clampColWidth(payload.width),
        },
      })
    })

    on("sheet:resize-end", () => {
      set({ resizeCol: null })
      emit("render")
    })

    on("sheet:refresh", () => {
      lastFetchKey = ""
      void refreshWindow({ force: true })
    })

    on("sheet:viewport", (payload) => {
      const height =
        typeof payload === "number" ? payload : Number(payload?.h) || 600
      const width = typeof payload === "number" ? undefined : payload?.w
      set({
        viewportH: height,
        ...(width != null ? { viewportW: width } : {}),
      })
      lastFetchKey = ""
      void refreshWindow({ viewportH: height, force: true })
    })
  },
})

/** @deprecated use sheetFeature.store */
export function sheetStore() {
  return sheetFeature.store
}
