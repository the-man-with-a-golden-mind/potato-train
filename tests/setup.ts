/**
 * Global test setup — happy-dom provides window/document.
 * Polyfill bits missing for Web Crypto / performance where needed.
 */
import { webcrypto } from "node:crypto"

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  })
}

if (typeof performance === "undefined" || !performance.now) {
  // happy-dom usually has this
  ;(globalThis as { performance: Performance }).performance = {
    now: () => Date.now(),
  } as Performance
}
