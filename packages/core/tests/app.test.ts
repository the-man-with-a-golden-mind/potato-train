import { describe, expect, it } from "vitest"
import { potato, defineStore, h, renderToString } from "../src/index.js"

describe("potato app", () => {
  it("renders routes with h()", () => {
    const app = potato()
    app.route("/", () => h("div", { class: "hi" }, "hello"))
    expect(app.toString("/")).toBe('<div class="hi">hello</div>')
  })

  it("runs stores before toString (SSR)", () => {
    const app = potato()
    app.use(
      defineStore("n", { n: 7 }, () => {
        /* seeded by initial state */
      }),
    )
    app.route("/", (state) => h("span", null, String((state as { n: number }).n)))
    expect(app.toString("/")).toBe("<span>7</span>")
  })

  it("matches params and query", () => {
    const app = potato()
    app.route("/u/:id", (state) =>
      h("p", null, `${state.params.id}:${state.query.tab ?? ""}`),
    )
    // query is applied via applyLocation on full location string
    const html = app.toString("/u/99?tab=profile")
    expect(html).toContain("99")
  })

  it("lists routes", () => {
    const app = potato()
    app.route("/", () => null)
    app.route("/a", () => null)
    expect(app.routes().map((r) => r.path)).toEqual(["/", "/a"])
  })

  it("renderToString escapes text", () => {
    expect(renderToString(h("b", null, "<script>"))).toBe(
      "<b>&lt;script&gt;</b>",
    )
  })

  it("handles nested children", () => {
    const tree = h("ul", null, h("li", null, "a"), h("li", null, "b"))
    expect(renderToString(tree)).toBe("<ul><li>a</li><li>b</li></ul>")
  })

  it("h with null props and falsy children", () => {
    const tree = h("div", null, null, false, true, "ok")
    expect(renderToString(tree)).toContain("ok")
    const tree2 = h("div", { key: 1 }, "x")
    expect(tree2.key).toBe(1)
  })


  it("supports functional components", () => {
    const Title = (props: { text: string }) => h("h1", null, props.text)
    const app = potato()
    app.route("/", () => h(Title as never, { text: "Potato" }))
    expect(app.toString("/")).toBe("<h1>Potato</h1>")
  })
})
