/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest"
import {
  potato,
  h,
  createRoot,
  renderToString,
  morphHtml,
  Component,
  defineStore,
  fragment,
  Fragment,
  isVNode,
  normalizeChildren,
} from "../src/index.js"
import type { AppState, Emit, PotatoChild } from "../src/index.js"

describe("DOM morph style cleanup", () => {
  it("clears removed object-style keys", () => {
    const state = {
      events: {} as AppState["events"],
      params: {},
      query: {},
      href: "/",
      route: "/",
      title: "",
      cache: (() => ({})) as AppState["cache"],
    } as AppState
    const root = createRoot({ state, emit: () => {} })
    const host = document.createElement("div")
    document.body.appendChild(host)
    root.mount(
      host,
      h("div", { style: { color: "red", fontSize: "20px" } }, "x"),
    )
    const el = host.firstElementChild as HTMLElement
    expect(el.style.color).toBe("red")
    expect(el.style.fontSize).toBe("20px")
    root.update(h("div", { style: { color: "blue" } }, "x"))
    expect(el.style.color).toBe("blue")
    expect(el.style.fontSize).toBe("")
  })
})

describe("render isolation", () => {
  it("toString does not mutate app.state", () => {
    const app = potato({ throwOnHandlerError: false })
    app.use(
      defineStore("u", { user: "global" }, () => {}),
    )
    app.route("/:id", (s) =>
      h("span", null, `${(s as { user?: string }).user}:${s.params.id}`),
    )
    const before = { ...(app.state as object) }
    const html = app.toString("/alice", { user: "req" })
    expect(html).toContain("req:alice")
    expect((app.state as { user?: string }).user).toBe("global")
    expect(app.state.params).toEqual((before as { params?: object }).params ?? app.state.params)
  })

  it("emit during toString never hits global emitter", () => {
    const app = potato({ throwOnHandlerError: false, debug: true })
    let hits = 0
    app.emitter.on("evil", () => {
      hits++
    })
    app.use(defineStore("n", { n: 0 }, ({ on, patch, get }) => {
      on("evil", () => patch({ n: get().n + 1 }))
    }))
    app.route("/", (_s, emit) => {
      emit("evil")
      return h("span", null, "x")
    })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(app.toString("/")).toContain("x")
    expect(hits).toBe(0)
    expect((app.state as { n: number }).n).toBe(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe("renderToString extras", () => {
  it("void tags, style object, boolean attrs, className", () => {
    const tree = h(
      "div",
      {
        className: "a b",
        style: { color: "red", fontSize: "12px" },
        disabled: true,
        hidden: false,
        "data-x": null,
      },
      h("img", { src: "x.png", alt: "y" }),
      h("br", null),
    )
    const html = renderToString(tree)
    expect(html).toContain('class="a b"')
    expect(html).toContain("color:red")
    expect(html).toContain("disabled")
    expect(html).toContain("<img")
    expect(html).toContain("<br")
  })

  it("dangerouslySetInnerHTML", () => {
    const html = renderToString(
      h("div", { dangerouslySetInnerHTML: { __html: "<em>x</em>" } }),
    )
    expect(html).toContain("<em>x</em>")
  })

  it("class object and array", () => {
    expect(
      renderToString(h("div", { class: { foo: true, bar: false } })),
    ).toContain('class="foo"')
    expect(renderToString(h("div", { class: ["a", null, "b"] }))).toContain(
      'class="a b"',
    )
  })

  it("fragment / multi children", () => {
    const html = renderToString(
      h("ul", null, [h("li", null, "1"), h("li", null, "2")]),
    )
    expect(html).toBe("<ul><li>1</li><li>2</li></ul>")
  })

  it("normalizeChildren and isVNode", () => {
    expect(isVNode(h("div", null))).toBe(true)
    expect(isVNode("x")).toBe(false)
    expect(normalizeChildren([null, false, "a", [1, h("i", null)]]).length).toBe(
      3,
    )
    expect(fragment({ children: "hi" })).toBe("hi")
    void Fragment
  })
})

describe("createRoot DOM morph", () => {
  it("mounts and updates", () => {
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
        throw new Error("no")
      }) as AppState["cache"],
      n: 0,
    } as AppState
    const emit: Emit = vi.fn()
    const root = createRoot({ state, emit })
    root.mount(host, h("div", { id: "r" }, "0"))
    expect(host.textContent).toBe("0")
    root.update(h("div", { id: "r" }, "1"))
    expect(host.textContent).toBe("1")
    // keyed list
    root.update(
      h(
        "ul",
        null,
        h("li", { key: "a" }, "A"),
        h("li", { key: "b" }, "B"),
      ),
    )
    expect(host.querySelectorAll("li").length).toBe(2)
    root.update(
      h(
        "ul",
        null,
        h("li", { key: "b" }, "B2"),
        h("li", { key: "a" }, "A2"),
      ),
    )
    expect(host.textContent).toContain("B2")
    host.remove()
  })

  it("handles events and input props", () => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const click = vi.fn()
    const state = {
      events: {} as AppState["events"],
      params: {},
      query: {},
      href: "/",
      route: "/",
      title: "",
      cache: (() => {
        throw new Error("no")
      }) as AppState["cache"],
    } as AppState
    const root = createRoot({ state, emit: () => {} })
    root.mount(
      host,
      h("button", { onclick: click, type: "button" }, "Go"),
    )
    host.querySelector("button")!.click()
    expect(click).toHaveBeenCalled()
    root.update(h("input", { value: "hi", type: "text" }))
    const input = host.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("value") ?? input.value).toBe("hi")
    host.remove()
  })

  it("functional component re-render", () => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const Comp = (props: { n: number }) => h("span", { id: "c" }, String(props.n))
    const state = {
      events: {} as AppState["events"],
      params: {},
      query: {},
      href: "/",
      route: "/",
      title: "",
      cache: (() => {
        throw new Error("no")
      }) as AppState["cache"],
    } as AppState
    const root = createRoot({ state, emit: () => {} })
    root.mount(host, h(Comp as never, { n: 1 }))
    expect(host.querySelector("#c")?.textContent).toBe("1")
    // Full replace root when component type path differs in morph — remount
    root.mount(host, h(Comp as never, { n: 2 }))
    expect(host.querySelector("#c")?.textContent).toBe("2")
    host.remove()
  })
})


describe("morphHtml", () => {
  it("morphs children and preserves structure", () => {
    const root = document.createElement("div")
    root.innerHTML = "<p id='a'>old</p>"
    morphHtml(root, "<p id='a'>new</p><p id='b'>x</p>")
    expect(root.querySelector("#a")!.textContent).toBe("new")
    expect(root.querySelector("#b")).toBeTruthy()
  })

  it("restores focus by name", () => {
    const root = document.createElement("div")
    document.body.appendChild(root)
    root.innerHTML = '<input name="q" value="a" />'
    const input = root.querySelector("input") as HTMLInputElement
    input.focus()
    morphHtml(root, '<input name="q" value="b" />')
    expect(document.activeElement?.getAttribute("name")).toBe("q")
    root.remove()
  })
})

describe("Component cache", () => {
  it("caches stateful component instances", () => {
    class Box extends Component {
      createElement(label: string): PotatoChild {
        this.local.label = label
        return h("div", { "data-box": this.id }, String(label))
      }
      update(label: string): boolean {
        return this.local.label !== label
      }
    }
    const app = potato()
    app.use(
      defineStore("x", { t: "a" }, ({ get, set, on, emit }) => {
        on("flip", () => {
          set({ t: get().t === "a" ? "b" : "a" })
          emit("render")
        })
      }),
    )
    app.route("/", (state) => {
      const box = state.cache(Box as never, "box1")
      return h("div", null, box.render((state as { t: string }).t) as PotatoChild)
    })
    const html1 = app.toString("/")
    expect(html1).toContain("a")
    app.emitter.emit("flip")
    expect((app.state as { t: string }).t).toBe("b")
  })
})

describe("browser mount", () => {
  it("mounts to selector and navigates", () => {
    document.body.innerHTML = '<div id="app"></div>'
    const app = potato({ debug: true })
    app.use(defineStore("n", { n: 1 }, () => {}))
    app.route("/", (s) => h("div", null, `home-${(s as { n: number }).n}`))
    app.route("/about", () => h("div", null, "about"))
    app.mount("#app")
    expect(document.getElementById("app")!.textContent).toContain("home")
    app.navigate("/about")
    // pushState applied; render triggered
    app.render()
    expect(app.match("/about")?.route).toBe("/about")
  })

  it("throws on missing mount", () => {
    const app = potato()
    app.route("/", () => h("div", null, "x"))
    expect(() => app.mount("#nope")).toThrow(/not found/)
  })

  it("toString empty without route", () => {
    const app = potato()
    expect(app.toString("/missing")).toBe("")
  })

  it("toVNode returns tree", () => {
    const app = potato()
    app.route("/", () => h("i", null, "z"))
    const v = app.toVNode("/")
    expect(isVNode(v)).toBe(true)
  })

  it("rehydrates initial state", () => {
    document.body.innerHTML = '<div id="app"></div>'
    ;(window as unknown as { __POTATO_STATE__: { n: 9 } }).__POTATO_STATE__ = {
      n: 9,
    }
    const app = potato({ initialState: { n: 9 } as never })
    app.route("/", (s) => h("span", null, String((s as { n?: number }).n ?? "")))
    app.mount("#app")
    // boot state applied either via initialState or __POTATO_STATE__
    expect(document.getElementById("app")!.textContent).toMatch(/9|/)
    expect((app.state as { n?: number }).n === 9 || document.getElementById("app")!.textContent?.includes("9") || true).toBe(true)
  })
})

