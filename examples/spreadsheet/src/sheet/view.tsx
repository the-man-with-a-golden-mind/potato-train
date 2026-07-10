import type { TypedEmit, WithFrameworkEvents } from "potato-train-core"
import { DEFAULT_COL_W, ROW_HEAD_W } from "./constants.js"
import { colW, tableWidth } from "./helpers.js"
import type { SheetEvents, SheetState } from "./types.js"

type Emit = TypedEmit<WithFrameworkEvents<SheetEvents>>

export function SheetView(state: SheetState, emit: Emit) {
  const s = state
  const bodyH = Math.max(s.totalRows * s.rowHeight, s.rowHeight)
  const tw = Math.max(tableWidth(s), ROW_HEAD_W + DEFAULT_COL_W * 8)
  const offsetY = s.window.offsetY
  const formulaDisplay =
    s.editing != null || s.selected != null ? s.editValue : ""

  const onGridKey = (e: KeyboardEvent) => {
    // Let inputs handle their own keys
    const t = e.target as HTMLElement
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return

    if (s.editing) return

    if (e.key === "ArrowUp") {
      e.preventDefault()
      emit("sheet:move", { dCol: 0, dRow: -1 })
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      emit("sheet:move", { dCol: 0, dRow: 1 })
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      emit("sheet:move", { dCol: -1, dRow: 0 })
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      emit("sheet:move", { dCol: 1, dRow: 0 })
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault()
      if (s.selected) emit("sheet:edit-start", s.selected)
    } else if (e.key === "Tab") {
      e.preventDefault()
      emit("sheet:move", { dCol: e.shiftKey ? -1 : 1, dRow: 0 })
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault()
      emit("sheet:clear")
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Type to overwrite like Excel
      if (s.selected) {
        e.preventDefault()
        emit("sheet:edit-start", s.selected)
        // After edit-start async, set the typed char
        queueMicrotask(() => emit("sheet:edit-change", e.key))
      }
    }
  }

  return (
    <div class="sheet-app font-sans" tabIndex={0} onkeydown={onGridKey}>
      <header class="flex shrink-0 items-center gap-3 bg-emerald-700 px-3 py-1.5 text-white">
        <h1 class="m-0 text-[15px] font-semibold">Potato Sheet</h1>
        <span class="min-w-0 flex-1 truncate text-xs text-emerald-100">
          {s.status}
        </span>
        <button
          type="button"
          class="rounded bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
          disabled={s.busy}
          onclick={() => emit("sheet:refresh")}
        >
          Refresh
        </button>
      </header>

      <div class="formula-bar">
        <div class="name-box">{s.editing ?? s.selected ?? ""}</div>
        <span class="fx">fx</span>
        <input
          class="formula-input"
          value={formulaDisplay}
          placeholder="Select a cell — formulas start with = (e.g. =B2*C2)"
          disabled={s.busy || (!s.editing && !s.selected)}
          onfocus={() => {
            if (s.selected && !s.editing) emit("sheet:edit-start", s.selected)
          }}
          oninput={(e: Event) => {
            const v = (e.target as HTMLInputElement).value
            if (!s.editing && s.selected) emit("sheet:edit-start", s.selected)
            emit("sheet:edit-change", v)
          }}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === "Enter") {
              e.preventDefault()
              if (s.editing) emit("sheet:edit-commit", { move: "down" })
            }
            if (e.key === "Escape") {
              e.preventDefault()
              if (s.editing) emit("sheet:edit-cancel")
            }
            if (e.key === "Tab") {
              e.preventDefault()
              if (s.editing) emit("sheet:edit-commit", { move: "right" })
            }
          }}
        />
      </div>

      <div
        class="grid-scroll"
        onscroll={(e: Event) => {
          const el = e.target as HTMLElement
          emit("sheet:scroll", { top: el.scrollTop, left: el.scrollLeft })
        }}
        ref={(el: Element | null) => {
          if (!(el instanceof HTMLElement)) return
          if (Math.abs(el.scrollTop - s.scrollTop) > 2) el.scrollTop = s.scrollTop
          if (Math.abs(el.scrollLeft - s.scrollLeft) > 2)
            el.scrollLeft = s.scrollLeft
          if (
            el.clientHeight > 40 &&
            Math.abs(el.clientHeight - s.viewportH) > 30
          ) {
            emit("sheet:viewport", { h: el.clientHeight, w: el.clientWidth })
          }
        }}
      >
        <div
          class="grid-canvas"
          style={{
            width: `${tw}px`,
            height: `${s.headerH + bodyH}px`,
            position: "relative",
          }}
        >
          <div
            class="header-row"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 4,
              height: `${s.headerH}px`,
              width: `${tw}px`,
              display: "flex",
            }}
          >
            <div
              class="corner sticky-corner"
              style={{
                width: `${ROW_HEAD_W}px`,
                minWidth: `${ROW_HEAD_W}px`,
                height: `${s.headerH}px`,
                position: "sticky",
                left: 0,
                zIndex: 5,
              }}
            />
            {s.headers.map((hd) => (
              <div
                key={hd}
                class="col-head"
                style={{
                  width: `${colW(s, hd)}px`,
                  minWidth: `${colW(s, hd)}px`,
                  height: `${s.headerH}px`,
                }}
              >
                <span>{hd}</span>
                <i
                  class={"col-resizer" + (s.resizeCol === hd ? " active" : "")}
                  onmousedown={(e: MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const startX = e.clientX
                    const startW = colW(s, hd)
                    emit("sheet:resize-start", hd)
                    const move = (ev: MouseEvent) => {
                      emit("sheet:resize-move", {
                        col: hd,
                        width: startW + (ev.clientX - startX),
                      })
                    }
                    const up = () => {
                      window.removeEventListener("mousemove", move)
                      window.removeEventListener("mouseup", up)
                      emit("sheet:resize-end")
                    }
                    window.addEventListener("mousemove", move)
                    window.addEventListener("mouseup", up)
                  }}
                />
              </div>
            ))}
          </div>

          <div
            class="grid-body"
            style={{
              position: "absolute",
              top: `${s.headerH + offsetY}px`,
              left: 0,
              width: `${tw}px`,
            }}
          >
            {s.rows.map((row) => (
              <div
                key={row.row}
                class="grid-row"
                style={{ height: `${s.rowHeight}px`, display: "flex" }}
              >
                <div
                  class="row-head sticky-row-head"
                  style={{
                    width: `${ROW_HEAD_W}px`,
                    minWidth: `${ROW_HEAD_W}px`,
                    height: `${s.rowHeight}px`,
                    lineHeight: `${s.rowHeight}px`,
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                  }}
                >
                  {row.row + 1}
                </div>
                {row.cells.map((cell, i) => {
                  const hd = s.headers[i] ?? "A"
                  const w = colW(s, hd)
                  const isEdit = s.editing === cell.key
                  const isSel = s.selected === cell.key && !isEdit
                  const display =
                    cell.value === null || cell.value === undefined
                      ? ""
                      : String(cell.value)
                  return (
                    <div
                      key={cell.key}
                      class={
                        "cell" +
                        (String(cell.raw).startsWith("=") ? " formula" : "") +
                        (isEdit ? " editing" : "") +
                        (isSel ? " selected" : "")
                      }
                      style={{
                        width: `${w}px`,
                        minWidth: `${w}px`,
                        height: `${s.rowHeight}px`,
                        lineHeight: `${s.rowHeight}px`,
                      }}
                      title={cell.raw ? `${cell.key}: ${cell.raw}` : cell.key}
                      onmousedown={(e: MouseEvent) => {
                        if (e.detail > 1) e.preventDefault()
                      }}
                      onclick={() => {
                        emit("sheet:select", cell.key)
                        // keep keyboard nav on the sheet root
                        ;(
                          document.querySelector(".sheet-app") as HTMLElement | null
                        )?.focus()
                      }}
                      ondblclick={() => emit("sheet:edit-start", cell.key)}
                    >
                      {isEdit ? (
                        <input
                          class="cell-input"
                          value={s.editValue}
                          autofocus
                          oninput={(e: Event) => {
                            emit(
                              "sheet:edit-change",
                              (e.target as HTMLInputElement).value,
                            )
                          }}
                          onkeydown={(e: KeyboardEvent) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              emit("sheet:edit-commit", { move: "down" })
                            }
                            if (e.key === "Escape") {
                              e.preventDefault()
                              emit("sheet:edit-cancel")
                            }
                            if (e.key === "Tab") {
                              e.preventDefault()
                              emit("sheet:edit-commit", { move: "right" })
                            }
                          }}
                          onclick={(e: Event) => e.stopPropagation()}
                        />
                      ) : (
                        <span class="cell-text">{display}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer class="status-bar shrink-0 border-t border-neutral-300 bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-600">
        {s.rows.length
          ? `Rows ${s.window.start + 1}–${s.window.end} of ${s.totalRows.toLocaleString()} · ${s.headers.length} cols · F2 edit · arrows · Del clear · Tailwind + grid CSS`
          : "Loading rows…"}
      </footer>
    </div>
  )
}
