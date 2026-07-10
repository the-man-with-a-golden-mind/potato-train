import { connectLive } from "potato-train-live/client"
import { createSaperApp } from "./app.js"

const app = createSaperApp()
app.mount("#app")

// Proof-of-work solver (SHA-256)
async function solvePoW(
  nickname: string,
  challenge: string,
  difficulty: number,
  onProgress: (progress: number, status: string) => void,
): Promise<string> {
  const enc = new TextEncoder()
  const prefix = nickname + challenge
  const prefixBytes = enc.encode(prefix)
  const zeros = "0".repeat(difficulty)
  let nonce = 0
  const max = 10_000_000

  // We check in chunks to allow DOM updates
  while (nonce < max) {
    if (nonce % 3000 === 0 && nonce > 0) {
      const targetAttempts = Math.pow(16, difficulty)
      const progress = Math.min(99, Math.floor((nonce / targetAttempts) * 100))
      onProgress(progress, `Mined ${nonce} nonces...`)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    const nonceStr = String(nonce)
    const nonceBytes = enc.encode(nonceStr)
    const combined = new Uint8Array(prefixBytes.length + nonceBytes.length)
    combined.set(prefixBytes)
    combined.set(nonceBytes, prefixBytes.length)

    const hashBuffer = await crypto.subtle.digest("SHA-256", combined)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

    if (hashHex.startsWith(zeros)) {
      return nonceStr
    }
    nonce++
  }
  throw new Error("Mining failed to find nonce")
}

// Listen to local login action
document.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement
  if (target && target.id === "join-btn") {
    const input = document.getElementById("nickname-input") as HTMLInputElement
    const nickname = input?.value?.trim()
    if (!nickname) {
      alert("Please enter a nickname!")
      return
    }

    const state = app.state
    const challenge = state.challenge
    const difficulty = state.difficulty || 3

    if (!challenge) {
      alert("Server did not send PoW challenge. Please refresh.")
      return
    }

    // Update local loader state
    app.emitter.emit("saper:mining-progress", { progress: 0, status: "Starting miner..." })

    try {
      const nonce = await solvePoW(nickname, challenge, difficulty, (progress, status) => {
        app.emitter.emit("saper:mining-progress", { progress, status })
      })

      app.emitter.emit("saper:mining-progress", { progress: 100, status: "Challenge solved! Connecting..." })

      const proto = location.protocol === "https:" ? "wss" : "ws"
      const url = `${proto}://${location.host}/__potato/live`

      const live = connectLive({
        url,
        topic: "saper-global",
        root: "#app",
        onState: (newState) => {
          Object.assign(app.state, newState)
        },
      })
      liveClient = live

      // Send join event
      live.sendEvent("saper:join", { nickname, nonce })

      // Set nickname locally
      app.emitter.emit("saper:set-nickname", nickname)

      // Listen to scroll events on document (capture phase)
      document.addEventListener(
        "scroll",
        (e) => {
          const el = e.target as HTMLElement
          if (el && el.id === "saper-viewport") {
            live.sendEvent("saper:scroll", { top: el.scrollTop, left: el.scrollLeft })
          }
        },
        true,
      )

      // Watch for saper-viewport insertion to send initial dimensions
      const observer = new MutationObserver(() => {
        const el = document.getElementById("saper-viewport")
        if (el) {
          live.sendEvent("saper:viewport", { h: el.clientHeight || 500, w: el.clientWidth || 720 })
        }
      })
      observer.observe(document.getElementById("app") || document.body, {
        childList: true,
        subtree: true,
      })

      // Also listen to window resize
      window.addEventListener("resize", () => {
        const el = document.getElementById("saper-viewport")
        if (el) {
          live.sendEvent("saper:viewport", { h: el.clientHeight, w: el.clientWidth })
        }
      })
    } catch (err) {
      alert("Mining failed: " + err)
      app.emitter.emit("saper:mining-progress", { progress: 0, status: "Idle" })
    }
  }
})

let liveClient: any = null

// Trigger local render periodically to update timer/cooldown display in real-time
setInterval(() => {
  app.emitter.emit("render")
}, 250)

// Listen to right-clicks on cells to place flag (requires PoW)
document.addEventListener("contextmenu", async (e) => {
  const target = e.target as HTMLElement
  const cell = target.closest(".saper-cell") as HTMLElement
  if (cell && (cell.classList.contains("closed") || cell.classList.contains("flag")) && liveClient) {
    e.preventDefault()
    const r = Number(cell.getAttribute("data-r"))
    const c = Number(cell.getAttribute("data-c"))
    if (Number.isNaN(r) || Number.isNaN(c)) return

    const nickname = app.state.nickname
    const challenge = app.state.challenge
    const difficulty = app.state.difficulty || 3

    if (!nickname || !challenge) return

    const key = `${r}:${c}`
    app.emitter.emit("saper:set-mining-cell", { key, mining: true })

    try {
      const nonce = await solvePoW(
        nickname,
        challenge + `flag:${r}:${c}`,
        difficulty,
        () => {} // silent individual cell mining
      )
      
      liveClient.sendEvent("saper:flag", { r, c, nonce })
    } catch (err) {
      console.error("Flag mining failed:", err)
    } finally {
      app.emitter.emit("saper:set-mining-cell", { key, mining: false })
    }
  }
}, true)

// Listen to revive action (requires heavy PoW)
document.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement
  if (target && target.id === "revive-btn" && liveClient) {
    const nickname = app.state.nickname
    const challenge = app.state.challenge
    const difficulty = 5 // Heavy PoW difficulty target for new life

    if (!nickname || !challenge) return

    // Update local loader state
    app.emitter.emit("saper:mining-progress", { progress: 0, status: "Mining New Life..." })

    try {
      const nonce = await solvePoW(
        nickname,
        challenge + "revive",
        difficulty,
        (progress, status) => {
          app.emitter.emit("saper:mining-progress", { progress, status })
        }
      )

      app.emitter.emit("saper:mining-progress", { progress: 100, status: "New Life Mined! Reviving..." })

      // Send revive event
      liveClient.sendEvent("saper:revive", { nonce })
    } catch (err) {
      alert("Revive mining failed: " + err)
      app.emitter.emit("saper:mining-progress", { progress: 0, status: "Idle" })
    }
  }
})
