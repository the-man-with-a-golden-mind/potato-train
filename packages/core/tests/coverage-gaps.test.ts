/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest"
import {
  potato,
  h,
  defineStore,
  Component,
  createRoot,
  renderToString,
  morphHtml,
  createApp,
  createEmitter,
  createRouter,
  parseLocation,
} from "../src/index.js"
import type { AppState, Emit, PotatoChild } from "../src/index.js"
import { bindCache } from "../src/cache.js"

describe("coverage gaps core", () => {
  it("emitter debug trace path and silent error", () => {
    const e = createEmitter(true)
    const tr = vi.fn(() => {
      throw new Error("trace fail")
    })
    e.on("trace", tr)
    e.emit("hello", 1)
    expect(tr).toHaveBeenCalled()
  })

  it("router hash compile and trailing wildcard", () => {
    const r = createRouter()
    r.add("/files/*", () => null)
    expect(r.match("/files/a/b")?.params.wildcard).toBe("a/b")
    r.add("*", () => null)
    expect(r.match("/nope")?.route).toBe("*")
    expect(parseLocation("not a url ://").pathname).toBeTruthy()
  })

  it("Component class lifecycle", () => {
    class C extends Component {
      createElement(): PotatoChild {
        return h("div", null, "c")
      }
    }
    const c = new C("id", {} as AppState, (() => {}) as Emit)
    expect(c.render()).toBeTruthy()
    expect(c.update()).toBe(true)
    c.load(document.createElement("div"))
    c.unload(document.createElement("div"))
  })

  it("bindCache creates and LRU evicts", () => {
    class C extends Component {
      createElement(x: string): PotatoChild {
        return h("span", null, x)
      }
      update(): boolean {
        return false
      }
    }
    class D extends Component {
      createElement(x: string): PotatoChild {
        return h("span", null, x)
      }
      // no update() → always re-create path after mount
    }
    const state = {
      events: {} as AppState["events"],
      params: {},
      query: {},
      href: "/",
      route: "/",
      title: "",
      cache: null as unknown as AppState["cache"],
    } as AppState
    const cache = bindCache(
      2,
      () => state,
      () => (() => {}) as Emit,
    )
    state.cache = cache
    const a = cache(C as never, "a")
    a.element = document.createElement("div")
    a.render("1")
    const b = cache(C as never, "b")
    b.render("2")
    // third evicts
    cache(C as never, "c").render("3")
    // hit a may recreate
    const a2 = cache(C as never, "a")
    expect(a2.render("x")).toBeTruthy()
    // update returns false path
    const same = a2.render("x")
    expect(same).toBeTruthy()
    // call ref on same-node marker
    const marker = a2.render("x") as { props: { ref?: (el: Element | null) => void } }
    marker.props.ref?.(document.createElement("div"))
    const d = cache(D as never, "d")
    d.render("1")
    d.render("2")
  })

  it("app hash mode navigate replace start twice", () => {
    document.body.innerHTML = '<div id="app"></div>'
    const app = potato({ hash: true, history: true, href: true, debug: true })
    app.route("/", () => h("div", null, "home"))
    app.route("/x", () => h("div", null, "x"))
    app.mount("#app")
    app.start() // second start
    app.navigate("/x", { replace: true })
    app.navigate("/x")
    // SSR mount path
    const app2 = potato()
    // simulate no document for selector remember — skip
    app2.route("/", () => h("div", null, "s"))
    expect(app2.toString("/", { title: "T" })).toContain("s")
  })

  it("href click interception", () => {
    document.body.innerHTML = '<div id="app"></div><a href="/local">L</a>'
    const app = potato()
    app.route("/", () => h("div", null, "h"))
    app.route("/local", () => h("div", null, "L"))
    app.mount("#app")
    const a = document.querySelector("a")!
    a.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    )
  })

  it("morphHtml text and comment and id keyed", () => {
    const el = document.createElement("div")
    el.innerHTML = "old"
    morphHtml(el, "new text")
    morphHtml(el, "<!--c--><p id='p'>p</p>")
    morphHtml(el, "<!--c--><p id='p'>q</p>")
    expect(el.querySelector("#p")!.textContent).toBe("q")
  })

  it("renderToString component and empty", () => {
    const Comp = () => null
    expect(renderToString(h(Comp as never, {}))).toBe("")
    const Multi = () => [h("i", null, "a"), h("i", null, "b")]
    expect(renderToString(h(Multi as never, {}))).toContain("a")
  })

  it("createRoot empty tree and prop updates", () => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const state = {
      events: {} as AppState["events"],
      params: {},
      query: {},
      href: "/",
      route: "/",
      title: "",
      cache: (() => {
        throw new Error("x")
      }) as AppState["cache"],
    } as AppState
    const root = createRoot({ state, emit: () => {} })
    root.mount(host, h("div", null, "d"))
    root.update(h("div", { class: "x", style: "color:red", onclick: () => {} }, "e"))
    root.update(h("div", { class: "y" }, "f"))
    root.update(h("div", null, "g"))
    root.update(h("div", null, h("span", { key: "1" }, "a"), h("span", { key: "2" }, "b")))
    root.update(h("div", null, h("span", { key: "2" }, "b2")))
    host.remove()
  })

  it("createApp emitter accessors", () => {
    const app = createApp({ state: { a: 1 } })
    app.emitter.on("render", () => {})
    app.emitter.once("render", () => {})
    app.emitter.off("render", () => {})
    app.emitter.listeners("render")
    app.route("/", () => h("div", null, "z"))
    expect(app.toString("/")).toContain("z")
    document.body.innerHTML = '<div id="root"></div>'
    app.mount("#root")
    app.start()
    expect(app.match("/")).toBeTruthy()
  })


  it("store without setup throws", () => {
    expect(() =>
      // @ts-expect-error missing setup
      defineStore("bad", { a: 1 }),
    ).toThrow(/missing setup/)
  })

  it("defineStore setup-only form", () => {
    const app = potato()
    app.use(
      defineStore<{ z: number }>("z", ({ set }) => {
        set({ z: 3 })
      }),
    )
    app.route("/", (s) => h("i", null, String((s as { z: number }).z)))
    expect(app.toString("/")).toContain("3")
  })
})
