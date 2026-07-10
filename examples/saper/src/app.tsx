import {
  createApp as createTypedApp,
  defineFeature,
  combineState,
  asRawApp,
  type TypedPotatoApp,
  type PotatoApp,
} from "potato-train-core"
import { computeWindow, type VirtualWindow } from "potato-train-virtual"
import { liveClick } from "potato-train-live"

// Board Constants
export const CELL_SIZE = 30
export const GRID_ROWS = 1000
export const GRID_COLS = 1000
export const OVERSCAN = 3
export const BOMB_DENSITY = 15 // 15% density

export type CellState = {
  type: "open" | "flag"
  player: string
}

export type LockState = {
  lockedBy: string
  expiresAt: number
}

export type SaperState = {
  nickname: string | null
  challenge: string | null
  difficulty: number
  mining: boolean
  miningProgress: number
  miningStatus: string
  miningCells: Record<string, boolean> // Local mining status of cells
  
  seed: string
  revealed: Record<string, CellState> // Keyed by "r:c"
  locks: Record<string, LockState> // Keyed by "r:c"
  cooldown: number // Cooldown timestamp
  dead: boolean
  
  totalRows: number
  totalCols: number
  scrollTop: number
  scrollLeft: number
  viewportH: number
  viewportW: number
  window: VirtualWindow
}

export type SaperEvents = {
  "saper:join": [payload: { nickname: string; nonce: string }]
  "saper:reveal": [payload: { r: number; c: number }]
  "saper:flag": [payload: { r: number; c: number; nonce: string }]
  "saper:scroll": [payload: { top: number; left: number }]
  "saper:viewport": [payload: { h: number; w: number }]
  "saper:reset": []
  
  // Client local events
  "saper:set-pow": [payload: { challenge: string; difficulty: number }]
  "saper:mining-progress": [payload: { progress: number; status: string }]
  "saper:set-nickname": [nickname: string]
  "saper:set-cooldown": [cooldown: number]
  "saper:set-mining-cell": [payload: { key: string; mining: boolean }]
  "saper:die": []
}

// Deterministic PRNG Bomb check
export function isBomb(seed: string, r: number, c: number): boolean {
  let hash = 5381
  const key = `${seed}:${r}:${c}`
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i)
  }
  const val = (hash >>> 0) % 100
  return val < BOMB_DENSITY
}

export function getNeighborMines(
  seed: string,
  r: number,
  c: number,
  totalRows: number,
  totalCols: number,
): number {
  let count = 0
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < totalRows && nc >= 0 && nc < totalCols) {
        if (isBomb(seed, nr, nc)) count++
      }
    }
  }
  return count
}

const initialWindow: VirtualWindow = {
  start: 0,
  end: 25,
  offsetY: 0,
  visibleCount: 25,
  totalHeight: GRID_ROWS * CELL_SIZE,
}

export const saperFeature = defineFeature<SaperState, SaperEvents>({
  name: "saper",
  state: {
    nickname: null,
    challenge: null,
    difficulty: 3,
    mining: false,
    miningProgress: 0,
    miningStatus: "Idle",
    miningCells: {},
    
    seed: "potato-saper-game",
    revealed: {},
    locks: {},
    cooldown: 0,
    dead: false,
    
    totalRows: GRID_ROWS,
    totalCols: GRID_COLS,
    scrollTop: 0,
    scrollLeft: 0,
    viewportH: 500,
    viewportW: 720,
    window: initialWindow,
  },
  setup: ({ get, patch, on }) => {
    on("saper:set-pow", ({ challenge, difficulty }) => {
      patch({ challenge, difficulty })
    })

    on("saper:mining-progress", ({ progress, status }) => {
      patch({ mining: true, miningProgress: progress, miningStatus: status })
    })

    on("saper:set-nickname", (nickname) => {
      patch({ nickname, mining: false })
    })

    on("saper:set-cooldown", (cooldown) => {
      patch({ cooldown })
    })

    on("saper:set-mining-cell", ({ key, mining }) => {
      const s = get()
      const miningCells = { ...s.miningCells }
      if (mining) {
        miningCells[key] = true
      } else {
        delete miningCells[key]
      }
      patch({ miningCells })
    })

    on("saper:die", () => {
      patch({ dead: true })
    })

    on("saper:scroll", ({ top, left }) => {
      const s = get()
      const bodyH = Math.max(80, s.viewportH - 60)
      const vw = computeWindow(top, bodyH, {
        rowHeight: CELL_SIZE,
        overscan: OVERSCAN,
        totalRows: s.totalRows,
      })
      patch({ scrollTop: top, scrollLeft: left, window: vw })
    })

    on("saper:viewport", ({ h, w }) => {
      const s = get()
      const bodyH = Math.max(80, h - 60)
      const vw = computeWindow(s.scrollTop, bodyH, {
        rowHeight: CELL_SIZE,
        overscan: OVERSCAN,
        totalRows: s.totalRows,
      })
      patch({ viewportH: h, viewportW: w, window: vw })
    })
  },
})

// Main Saper UI Layout
export function SaperView(state: SaperState, emit: any) {
  if (!state.nickname) {
    return renderLogin(state)
  }
  if (state.dead) {
    return renderDeadScreen(state)
  }

  const s = state
  const colStart = Math.max(0, Math.floor(s.scrollLeft / CELL_SIZE) - OVERSCAN)
  const colCount = Math.ceil(s.viewportW / CELL_SIZE) + OVERSCAN * 2
  const endCol = Math.min(s.totalCols, colStart + colCount)
  const offsetX = colStart * CELL_SIZE
  const tw = s.totalCols * CELL_SIZE
  const th = s.totalRows * CELL_SIZE

  const activeLocks = Object.entries(s.locks).filter(
    ([, lock]) => lock.expiresAt > Date.now(),
  )
  const locksMap = new Map(activeLocks)

  // Smile Face Type
  const smiley = s.dead ? "😵" : "🙂"

  const renderCell = (r: number, c: number) => {
    const key = `${r}:${c}`
    const cell = s.revealed[key]
    const lock = locksMap.get(key)
    const isMining = s.miningCells[key]
    
    // Check if cell is locked by another player
    const isLockedByOther = lock && lock.lockedBy !== s.nickname

    if (isMining) {
      return (
        <div
          key={key}
          data-r={r}
          data-c={c}
          class="saper-cell closed"
          style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px`, color: "#0000ff" }}
        >
          ⚙️
        </div>
      )
    }

    if (isLockedByOther) {
      return (
        <div
          key={key}
          class="saper-cell locked"
          style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
          title={`Locked by ${lock.lockedBy}`}
        />
      )
    }

    if (!cell) {
      // Closed cell
      return (
        <div
          key={key}
          data-r={r}
          data-c={c}
          class="saper-cell closed"
          style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
          {...liveClick("saper:reveal", { r, c })}
        />
      )
    }

    if (cell.type === "flag") {
      return (
        <div
          key={key}
          data-r={r}
          data-c={c}
          class="saper-cell closed flag"
          style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px`, color: "#ff0000" }}
        >
          🚩
        </div>
      )
    }

    // Open cell
    const isMine = isBomb(s.seed, r, c)
    if (isMine) {
      return (
        <div
          key={key}
          class="saper-cell mine"
          style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
        >
          💣
        </div>
      )
    }

    const count = getNeighborMines(s.seed, r, c, s.totalRows, s.totalCols)
    const countClass = count > 0 ? ` count-${count}` : ""
    return (
      <div
        key={key}
        class={`saper-cell open${countClass}`}
        style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
      >
        {count > 0 ? String(count) : ""}
      </div>
    )
  }

  const rows = []
  const startRow = s.window.start
  const endRow = s.window.end

  for (let r = startRow; r < endRow; r++) {
    const cells = []
    for (let c = colStart; c < endCol; c++) {
      cells.push(renderCell(r, c))
    }
    rows.push(
      <div key={r} class="grid-row" style={{ height: `${CELL_SIZE}px` }}>
        {cells}
      </div>
    )
  }

  // Calculate CD seconds remaining
  const cdSecs = s.cooldown > Date.now() ? Math.ceil((s.cooldown - Date.now()) / 1000) : 0

  return (
    <div class="saper-container">
      <div class="windows-window">
        <div class="window-titlebar">
          <span>Multiplayer Saper (1000x1000)</span>
          <span style={{ fontSize: "11px" }}>User: {s.nickname}</span>
        </div>
        
        <div class="saper-header">
          <div class="digital-display" title="Active locks map size">
            {String(activeLocks.length).padStart(3, "0")}
          </div>
          <button
            type="button"
            class="smiley-btn"
            {...liveClick("saper:reset")}
          >
            {smiley}
          </button>
          <div class="digital-display" title="Cooldown Seconds" style={{ color: cdSecs > 0 ? "#ff0000" : "#00ff00" }}>
            {String(cdSecs).padStart(3, "0")}
          </div>
        </div>

        <div class="window-body">
          <div
            id="saper-viewport"
            class="grid-scroll"
            style={{ width: `${s.viewportW}px`, height: `${s.viewportH}px` }}
            onscroll={(e: Event) => {
              const el = e.target as HTMLElement
              emit("saper:scroll", { top: el.scrollTop, left: el.scrollLeft })
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
                emit("saper:viewport", { h: el.clientHeight, w: el.clientWidth })
              }
            }}
          >
            <div
              class="grid-canvas"
              style={{
                width: `${tw}px`,
                height: `${th}px`,
              }}
            >
              <div
                class="grid-body"
                style={{
                  position: "absolute",
                  top: `${s.window.offsetY}px`,
                  left: `${offsetX}px`,
                }}
              >
                {rows}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function renderDeadScreen(state: SaperState) {
  return (
    <div class="saper-container">
      <div class="login-screen">
        <h2 style={{ margin: "0 0 10px 0", fontSize: "18px" }}>Game Over 💥</h2>
        <p style={{ fontSize: "12px", color: "#800000", fontWeight: "bold", margin: "0 0 15px 0" }}>
          You hit a mine!
        </p>

        {state.mining ? (
          <div>
            <div class="mining-status-text">Mining Heavy Revive Challenge...</div>
            <div class="mining-progress-bar">
              <div
                class="mining-progress-fill"
                style={{ width: `${state.miningProgress}%` }}
              />
            </div>
            <div class="mining-status-text">{state.miningStatus}</div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: "11px", color: "#505050" }}>
              Mining a new life requires checking approx. 1,000,000 hashes (~20-60 seconds of calculations).
            </p>
            <button
              type="button"
              id="revive-btn"
              style={{ marginTop: "10px" }}
            >
              Mine New Life
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function renderLogin(state: SaperState) {
  return (
    <div class="saper-container">
      <div class="login-screen">
        <h2 style={{ margin: "0 0 10px 0", fontSize: "18px" }}>Multiplayer Saper 💣</h2>
        <p style={{ fontSize: "11px", color: "#505050", margin: "0 0 15px 0" }}>
          Prove you are human by mining a retro block hash.
        </p>

        {state.mining ? (
          <div>
            <div class="mining-status-text">Mining Proof of Work nonce...</div>
            <div class="mining-progress-bar">
              <div
                class="mining-progress-fill"
                style={{ width: `${state.miningProgress}%` }}
              />
            </div>
            <div class="mining-status-text">{state.miningStatus}</div>
          </div>
        ) : (
          <div>
            <input
              type="text"
              id="nickname-input"
              maxLength={15}
              placeholder="Enter Nickname"
            />
            <button
              type="button"
              id="join-btn"
            >
              Mine & Join
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function createSaperApp(): TypedPotatoApp<SaperState, SaperEvents> {
  const app = createTypedApp<SaperState, SaperEvents>({
    href: false,
    state: combineState(saperFeature),
  })
  app.useFeature(saperFeature)
  app.route("/", (state, emit) => SaperView(state, emit))
  return app
}

export function createApp(): PotatoApp {
  return asRawApp(createSaperApp())
}
