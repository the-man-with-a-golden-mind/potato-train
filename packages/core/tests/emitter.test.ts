import { describe, expect, it, vi } from "vitest"
import { createEmitter } from "../src/emitter.js"

describe("createEmitter", () => {
  it("emits to listeners", () => {
    const e = createEmitter()
    const fn = vi.fn()
    e.on("ping", fn)
    e.emit("ping", 1, 2)
    expect(fn).toHaveBeenCalledWith(1, 2)
  })

  it("once only fires once", () => {
    const e = createEmitter()
    const fn = vi.fn()
    e.once("x", fn)
    e.emit("x")
    e.emit("x")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("off removes listener", () => {
    const e = createEmitter()
    const fn = vi.fn()
    e.on("x", fn)
    e.off("x", fn)
    e.emit("x")
    expect(fn).not.toHaveBeenCalled()
  })

  it("routes listener errors to error handlers", () => {
    const e = createEmitter()
    const errHandler = vi.fn()
    e.on("error", errHandler)
    e.on("boom", () => {
      throw new Error("fail")
    })
    e.emit("boom")
    expect(errHandler).toHaveBeenCalled()
  })

  it("debug traces events", () => {
    const e = createEmitter(true)
    const trace = vi.fn()
    e.on("trace", trace)
    e.emit("hello", 1)
    expect(trace).toHaveBeenCalledWith("hello", 1)
  })
})
