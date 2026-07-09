/**
 * Performance benchmarks — run with: pnpm test:bench
 */
import { bench, describe } from "vitest"
import { potato, h, defineStore, renderToString } from "../src/index.js"

function buildBigTree(rows: number) {
  return h(
    "table",
    null,
    h(
      "tbody",
      null,
      ...Array.from({ length: rows }, (_, i) =>
        h(
          "tr",
          { key: i },
          h("td", null, String(i)),
          h("td", null, `row-${i}`),
          h("td", null, String(i * 1.5)),
        ),
      ),
    ),
  )
}

describe("renderToString performance", () => {
  bench("1k row table", () => {
    renderToString(buildBigTree(1000))
  })

  bench("10k row table", () => {
    renderToString(buildBigTree(10_000))
  })
})

describe("router performance", () => {
  const app = potato()
  for (let i = 0; i < 200; i++) {
    app.route(`/item/${i}/:id`, () => h("div", null, String(i)))
  }
  app.route("/users/:uid/posts/:pid", () => h("div", null, "x"))

  bench("match among 200 routes", () => {
    app.match("/users/1/posts/2")
  })
})

describe("store + SSR performance", () => {
  const app = potato()
  const cells: Record<string, number> = {}
  for (let r = 0; r < 100; r++) {
    for (let c = 0; c < 20; c++) {
      cells[`${r}:${c}`] = r + c
    }
  }
  app.use(
    defineStore("grid", { cells }, () => {
      /* seeded */
    }),
  )
  app.route("/", (state) => {
    const cells = (state as { cells: Record<string, number> }).cells
    const keys = Object.keys(cells)
    return h(
      "div",
      null,
      ...keys.slice(0, 50).map((k) => h("span", { key: k }, String(cells[k]))),
    )
  })

  bench("SSR with 2k cells store (virtual 50)", () => {
    app.toString("/")
  })
})
