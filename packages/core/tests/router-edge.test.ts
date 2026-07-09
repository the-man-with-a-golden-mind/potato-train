import { describe, expect, it, vi } from "vitest"
import {
  createRouter,
  parseLocation,
  parseQuery,
  createEmitter,
  defineEvents,
} from "../src/index.js"
import type { View } from "../src/index.js"

const v: View = () => null

describe("router edges", () => {
  it("hash location and query empty pairs", () => {
    expect(parseLocation("https://ex.com/a?b=1#c").pathname).toBe("/a")
    expect(parseQuery("?&a=1&")).toEqual({ a: "1" })
    const r = createRouter()
    r.add("/x/:id", v)
    r.add("*", v)
    expect(r.match("/x/1")?.params.id).toBe("1")
    expect(r.list().length).toBeGreaterThan(0)
  })
})

describe("emitter edges", () => {
  it("off all and clear", () => {
    const e = createEmitter()
    const fn = () => {}
    e.on("a", fn)
    e.off("a")
    e.emit("a")
    e.on("b", fn)
    e.clear()
    expect(e.listeners("b")).toEqual([])
  })

  it("error without handler logs", () => {
    const e = createEmitter()
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    e.on("x", () => {
      throw new Error("boom")
    })
    e.emit("x")
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
})

describe("defineEvents", () => {
  it("returns map", () => {
    const ev = defineEvents({ a: true, b: true } as { a: true; b: true })
    expect(ev).toEqual({ a: true, b: true })
  })
})
