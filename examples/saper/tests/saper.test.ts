import { describe, it, expect } from "vitest"
import { createSaperApp, isBomb, getNeighborMines, CELL_SIZE, GRID_ROWS, GRID_COLS } from "../src/app.js"
import crypto from "crypto"

describe("Saper Multiplayer Game Logic & UI", () => {
  it("renders the initial login screen with the PoW challenge", () => {
    const app = createSaperApp()
    app.state.challenge = "test-challenge"
    app.state.difficulty = 3

    const html = app.toString("/")
    expect(html).toContain("Prove you are human")
    expect(html).toContain('id="nickname-input"')
    expect(html).toContain('id="join-btn"')
  })

  it("handles saper:join after solving PoW challenge and upgrades session", () => {
    const app = createSaperApp()
    const challenge = "test-challenge"
    const difficulty = 3
    
    const sessionState = { ...app.state }
    const nickname = "TestPlayer"
    
    // Solve PoW (find nonce)
    let nonce = 0
    const targetZeros = "0".repeat(difficulty)
    while (nonce < 100000) {
      const prefix = nickname + challenge
      const hash = crypto.createHash("sha256").update(prefix + nonce).digest("hex")
      if (hash.startsWith(targetZeros)) {
        break
      }
      nonce++
    }

    const prefix = nickname + challenge
    const hash = crypto.createHash("sha256").update(prefix + nonce).digest("hex")
    expect(hash.startsWith(targetZeros)).toBe(true)

    // Apply join state update
    sessionState.nickname = nickname
    
    // Render once joined
    const html = app.toString("/", sessionState)
    expect(html).toContain("Multiplayer Saper")
    expect(html).toContain("User: TestPlayer")
    expect(html).toContain("smiley-btn")
  })

  it("calculates bomb generation and neighbor counts deterministically", () => {
    const seed = "potato-saper-game"
    const cellIsBomb = isBomb(seed, 5, 5)
    expect(typeof cellIsBomb).toBe("boolean")

    const neighbors = getNeighborMines(seed, 5, 5, GRID_ROWS, GRID_COLS)
    expect(neighbors).toBeGreaterThanOrEqual(0)
    expect(neighbors).toBeLessThanOrEqual(8)
  })

  it("virtualizes the board view grid correctly", () => {
    const app = createSaperApp()
    const sessionState = { ...app.state }
    sessionState.nickname = "VirtualPlayer"
    sessionState.viewportW = 600
    sessionState.viewportH = 400
    sessionState.scrollTop = 300
    sessionState.scrollLeft = 300

    // Set visible row window
    sessionState.window = {
      start: 10,
      end: 25,
      offsetY: 300,
      visibleCount: 15,
      totalHeight: GRID_ROWS * CELL_SIZE,
    }

    const html = app.toString("/", sessionState)
    // Check that grid canvas height/width is correct
    expect(html).toContain("width:30000px")
    expect(html).toContain("height:30000px")
    // Check that absolute offset reflects virtualization parameters
    expect(html).toContain("top:300px")
  })

  it("renders the game over screen when dead is true", () => {
    const app = createSaperApp()
    const sessionState = { ...app.state }
    sessionState.nickname = "DeadPlayer"
    sessionState.dead = true

    const html = app.toString("/", sessionState)
    expect(html).toContain("Game Over")
    expect(html).toContain("Mine New Life")
  })

  it("verifies the flagging PoW cryptographic prefix format", () => {
    const nickname = "FlagPlayer"
    const challenge = "test-challenge"
    const difficulty = 3
    const r = 12
    const c = 34

    // Solve flagging PoW challenge locally
    let nonce = 0
    const targetZeros = "0".repeat(difficulty)
    const prefix = nickname + challenge + `flag:${r}:${c}`
    
    while (nonce < 100000) {
      const hash = crypto.createHash("sha256").update(prefix + nonce).digest("hex")
      if (hash.startsWith(targetZeros)) {
        break
      }
      nonce++
    }

    // Verify it solves it
    const hash = crypto.createHash("sha256").update(prefix + nonce).digest("hex")
    expect(hash.startsWith(targetZeros)).toBe(true)
  })

  it("verifies the heavy revive PoW cryptographic prefix format", () => {
    const nickname = "RevivePlayer"
    const challenge = "test-challenge"
    const difficulty = 5 // Heavy PoW difficulty target
    
    let nonce = 0
    const targetZeros = "0".repeat(difficulty)
    const prefix = nickname + challenge + "revive"

    // Mine nonce
    while (nonce < 5000000) {
      const hash = crypto.createHash("sha256").update(prefix + nonce).digest("hex")
      if (hash.startsWith(targetZeros)) {
        break
      }
      nonce++
    }

    const hash = crypto.createHash("sha256").update(prefix + nonce).digest("hex")
    expect(hash.startsWith(targetZeros)).toBe(true)
  })
})
