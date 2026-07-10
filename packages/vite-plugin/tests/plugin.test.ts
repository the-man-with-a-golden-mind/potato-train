import { describe, expect, it } from "vitest"
import { potato } from "../src/index.js"

describe("vite plugin", () => {
  it("configures jsx", () => {
    const plugin = potato()
    const conf = (plugin as { config: () => unknown }).config()
    expect(conf).toMatchObject({
      esbuild: { jsx: "automatic", jsxImportSource: "potato-train-jsx" },
    })
  })

  it("injects devtools comment in serve", () => {
    const plugin = potato()
    const html = "<html><head></head></html>"
    const out = (
      plugin as {
        transformIndexHtml: (h: string, c: { server?: unknown }) => string
      }
    ).transformIndexHtml(html, { server: {} })
    expect(out).toContain("devtools")
    // second pass: tip already present
    const out2 = (
      plugin as {
        transformIndexHtml: (h: string, c: { server?: unknown }) => string
      }
    ).transformIndexHtml(out, { server: {} })
    expect(out2).toBe(out)
  })

  it("custom jsxImportSource", () => {
    const plugin = potato({ jsxImportSource: "x" })
    const conf = (plugin as { config: () => { esbuild: { jsxImportSource: string } } }).config()
    expect(conf.esbuild.jsxImportSource).toBe("x")
  })


  it("skips comment when disabled", () => {
    const plugin = potato({ devtoolsComment: false })
    const html = "<html><head></head></html>"
    const out = (
      plugin as {
        transformIndexHtml: (h: string, c: { server?: unknown }) => string
      }
    ).transformIndexHtml(html, { server: {} })
    expect(out).toBe(html)
  })

  it("production transform returns html", () => {
    const plugin = potato()
    const html = "<html><head></head></html>"
    const out = (
      plugin as {
        transformIndexHtml: (h: string, c: { server?: unknown }) => string
      }
    ).transformIndexHtml(html, {})
    expect(out).toBe(html)
  })
})
