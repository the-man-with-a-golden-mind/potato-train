/**
 * Floating Potato debugger panel (injected CSS + DOM).
 */
import type { DiffEntry } from "./diff.js"
import { formatDiff } from "./diff.js"

export type PanelRecord = {
  id: number
  t: number
  event: string
  args: unknown[]
  kind: "event" | "render" | "navigate" | "framework"
  diffs: DiffEntry[]
  renderMs?: number
  stateAfter?: Record<string, unknown>
}

export type PanelApi = {
  push: (rec: PanelRecord) => void
  setState: (state: unknown) => void
  setStats: (s: { events: number; renders: number; lastRenderMs: number }) => void
  open: () => void
  close: () => void
  toggle: () => void
  destroy: () => void
}

const FRAMEWORK = new Set([
  "render",
  "navigate",
  "pushState",
  "replaceState",
  "popState",
  "DOMContentLoaded",
  "DOMTitleChange",
  "trace",
  "live:patch",
  "live:event",
])

export function classifyEvent(event: string): PanelRecord["kind"] {
  if (event === "render") return "render"
  if (event === "navigate" || event === "pushState" || event === "replaceState" || event === "popState")
    return "navigate"
  if (FRAMEWORK.has(event)) return "framework"
  return "event"
}

const CSS = `
#potato-debug-root {
  all: initial;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
  font-size: 12px;
  color: #e2e8f0;
  position: fixed;
  z-index: 2147483646;
  right: 12px;
  bottom: 12px;
  line-height: 1.4;
}
#potato-debug-root * { box-sizing: border-box; }
#potato-debug-fab {
  border: 0; cursor: pointer;
  background: linear-gradient(135deg, #f59e0b, #ea580c);
  color: #0f172a; font-weight: 800; font-size: 12px;
  padding: 10px 14px; border-radius: 999px;
  box-shadow: 0 8px 30px rgba(0,0,0,.45);
}
#potato-debug-fab:hover { filter: brightness(1.05); }
#potato-debug-panel {
  display: none;
  width: min(420px, calc(100vw - 24px));
  height: min(520px, calc(100vh - 24px));
  background: #0b1220;
  border: 1px solid #1e293b;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0,0,0,.55);
  overflow: hidden;
  flex-direction: column;
}
#potato-debug-root.open #potato-debug-panel { display: flex; }
#potato-debug-root.open #potato-debug-fab { display: none; }
#potato-debug-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; background: #111827; border-bottom: 1px solid #1e293b;
}
#potato-debug-head strong { color: #fbbf24; font-size: 13px; }
#potato-debug-head .muted { color: #94a3b8; flex: 1; font-size: 11px; }
#potato-debug-head button {
  background: #1e293b; color: #e2e8f0; border: 0; border-radius: 6px;
  padding: 4px 8px; cursor: pointer; font-size: 11px;
}
#potato-debug-head button:hover { background: #334155; }
#potato-debug-tabs {
  display: flex; gap: 2px; padding: 6px 8px; background: #0f172a; border-bottom: 1px solid #1e293b;
}
#potato-debug-tabs button {
  flex: 1; border: 0; background: transparent; color: #94a3b8;
  padding: 6px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 11px;
}
#potato-debug-tabs button.active { background: #1e293b; color: #fbbf24; }
#potato-debug-body {
  flex: 1; overflow: auto; padding: 8px;
}
#potato-debug-body .row {
  border: 1px solid #1e293b; border-radius: 8px; padding: 8px; margin-bottom: 6px;
  background: #0f172a; cursor: pointer;
}
#potato-debug-body .row:hover { border-color: #334155; }
#potato-debug-body .row.selected { border-color: #f59e0b; }
#potato-debug-body .ev { font-weight: 700; font-family: ui-monospace, monospace; font-size: 11px; }
#potato-debug-body .ev.event { color: #38bdf8; }
#potato-debug-body .ev.render { color: #4ade80; }
#potato-debug-body .ev.navigate { color: #c084fc; }
#potato-debug-body .ev.framework { color: #94a3b8; }
#potato-debug-body .meta { color: #64748b; font-size: 10px; margin-top: 2px; }
#potato-debug-body .diff { color: #fcd34d; font-family: ui-monospace, monospace; font-size: 10px;
  white-space: pre-wrap; margin-top: 6px; background: #020617; padding: 6px; border-radius: 6px; }
#potato-debug-body pre {
  margin: 0; white-space: pre-wrap; word-break: break-word;
  font-family: ui-monospace, monospace; font-size: 10px; color: #cbd5e1;
  background: #020617; padding: 8px; border-radius: 8px;
}
#potato-debug-stats {
  display: flex; gap: 8px; padding: 8px 10px; border-top: 1px solid #1e293b;
  background: #111827; font-size: 10px; color: #94a3b8;
}
#potato-debug-stats b { color: #e2e8f0; }
#potato-debug-hint {
  padding: 4px 10px 8px; font-size: 10px; color: #64748b; background: #111827;
}
`

export function createPanel(opts?: {
  maxRows?: number
  hotkey?: string
}): PanelApi {
  const maxRows = opts?.maxRows ?? 150
  let open = false
  let tab: "timeline" | "state" | "selected" = "timeline"
  let selectedId: number | null = null
  const records: PanelRecord[] = []
  let currentState: unknown = {}
  let stats = { events: 0, renders: 0, lastRenderMs: 0 }

  const root = document.createElement("div")
  root.id = "potato-debug-root"
  root.innerHTML = `
    <button type="button" id="potato-debug-fab" title="Potato debugger (Ctrl+Shift+P)">🥔 Debug</button>
    <div id="potato-debug-panel" role="dialog" aria-label="Potato debugger">
      <div id="potato-debug-head">
        <strong>🥔 Potato</strong>
        <span class="muted">events · state · renders</span>
        <button type="button" data-act="clear">Clear</button>
        <button type="button" data-act="close">✕</button>
      </div>
      <div id="potato-debug-tabs">
        <button type="button" data-tab="timeline" class="active">Timeline</button>
        <button type="button" data-tab="state">State</button>
        <button type="button" data-tab="selected">Detail</button>
      </div>
      <div id="potato-debug-body"></div>
      <div id="potato-debug-stats"></div>
      <div id="potato-debug-hint">Ctrl+Shift+P toggle · click a row for diffs · window.__POTATO__</div>
    </div>
  `
  const style = document.createElement("style")
  style.textContent = CSS
  document.head.appendChild(style)
  document.body.appendChild(root)

  const body = root.querySelector("#potato-debug-body") as HTMLElement
  const statsEl = root.querySelector("#potato-debug-stats") as HTMLElement
  const fab = root.querySelector("#potato-debug-fab") as HTMLButtonElement

  function setOpen(v: boolean) {
    open = v
    root.classList.toggle("open", open)
    if (open) render()
  }

  fab.onclick = () => setOpen(true)
  root.querySelector('[data-act="close"]')!.addEventListener("click", () => setOpen(false))
  root.querySelector('[data-act="clear"]')!.addEventListener("click", () => {
    records.length = 0
    selectedId = null
    render()
  })
  root.querySelectorAll("#potato-debug-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      tab = (btn as HTMLElement).dataset.tab as typeof tab
      root.querySelectorAll("#potato-debug-tabs button").forEach((b) =>
        b.classList.toggle("active", b === btn),
      )
      render()
    })
  })

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
      e.preventDefault()
      setOpen(!open)
    }
  }
  window.addEventListener("keydown", onKey)

  function render() {
    statsEl.innerHTML = `
      <span>events <b>${stats.events}</b></span>
      <span>renders <b>${stats.renders}</b></span>
      <span>last render <b>${stats.lastRenderMs.toFixed(1)}ms</b></span>
      <span>history <b>${records.length}</b></span>
    `
    if (tab === "state") {
      try {
        body.innerHTML = `<pre>${escapeHtml(JSON.stringify(currentState, null, 2))}</pre>`
      } catch {
        body.innerHTML = `<pre>${escapeHtml(String(currentState))}</pre>`
      }
      return
    }
    if (tab === "selected") {
      const rec = records.find((r) => r.id === selectedId)
      if (!rec) {
        body.innerHTML = `<div class="meta">Select a timeline row.</div>`
        return
      }
      body.innerHTML = `
        <div class="row selected">
          <div class="ev ${rec.kind}">${escapeHtml(rec.event)}</div>
          <div class="meta">${new Date(rec.t).toLocaleTimeString()} · ${rec.kind}${
            rec.renderMs != null ? ` · ${rec.renderMs.toFixed(1)}ms` : ""
          }</div>
          <div class="meta">args</div>
          <pre>${escapeHtml(JSON.stringify(rec.args, null, 2))}</pre>
          <div class="meta">state diff</div>
          <div class="diff">${escapeHtml(formatDiff(rec.diffs))}</div>
          ${
            rec.stateAfter
              ? `<div class="meta">state after</div><pre>${escapeHtml(
                  JSON.stringify(rec.stateAfter, null, 2),
                )}</pre>`
              : ""
          }
        </div>
      `
      return
    }
    // timeline
    const rows = [...records].reverse()
    body.innerHTML = rows
      .map((r) => {
        const argPreview =
          r.args.length === 0
            ? ""
            : escapeHtml(
                JSON.stringify(r.args.length === 1 ? r.args[0] : r.args).slice(
                  0,
                  100,
                ),
              )
        const diffHint =
          r.diffs.length > 0
            ? `<div class="diff">${escapeHtml(formatDiff(r.diffs).slice(0, 200))}</div>`
            : r.kind === "render"
              ? `<div class="meta">paint${r.renderMs != null ? ` ${r.renderMs.toFixed(1)}ms` : ""}</div>`
              : ""
        return `
        <div class="row ${selectedId === r.id ? "selected" : ""}" data-id="${r.id}">
          <div class="ev ${r.kind}">${escapeHtml(r.event)}</div>
          <div class="meta">${new Date(r.t).toLocaleTimeString()}${
            argPreview ? ` · ${argPreview}` : ""
          }</div>
          ${diffHint}
        </div>`
      })
      .join("")

    body.querySelectorAll(".row[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        selectedId = Number((el as HTMLElement).dataset.id)
        tab = "selected"
        root.querySelectorAll("#potato-debug-tabs button").forEach((b) => {
          b.classList.toggle(
            "active",
            (b as HTMLElement).dataset.tab === "selected",
          )
        })
        render()
      })
    })
  }

  return {
    push(rec) {
      records.push(rec)
      while (records.length > maxRows) records.shift()
      if (open) render()
    },
    setState(state) {
      currentState = state
      if (open && tab === "state") render()
    },
    setStats(s) {
      stats = s
      if (open) {
        statsEl.innerHTML = `
          <span>events <b>${stats.events}</b></span>
          <span>renders <b>${stats.renders}</b></span>
          <span>last render <b>${stats.lastRenderMs.toFixed(1)}ms</b></span>
          <span>history <b>${records.length}</b></span>
        `
      }
    },
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
    destroy() {
      window.removeEventListener("keydown", onKey)
      root.remove()
      style.remove()
    },
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
