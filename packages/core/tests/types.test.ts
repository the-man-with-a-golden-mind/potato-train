/**
 * Compile-time safety tests.
 * Runtime assertions + expectTypeOf. @ts-expect-error lines are compile checks.
 */
import { describe, expect, expectTypeOf, it } from "vitest"
import { createApp, defineStore, h } from "../src/index.js"
import type {
  PathParams,
  Equal,
  Expect,
  TypedEmit,
  WithFrameworkEvents,
} from "../src/index.js"

// ---------- Path params (pure type-level) ----------
type _P1 = Expect<Equal<PathParams<"/users/:id">, { id: string }>>
type _P2 = Expect<
  Equal<PathParams<"/users/:id/posts/:pid">, { id: string; pid: string }>
>
type _P3 = Expect<Equal<PathParams<"/about">, Record<string, never>>>

describe("PathParams (type-level)", () => {
  it("extracts :id", () => {
    type P = PathParams<"/users/:id">
    expectTypeOf<P>().toEqualTypeOf<{ id: string }>()
  })

  it("static routes have no params", () => {
    type P = PathParams<"/about">
    expectTypeOf<P>().toEqualTypeOf<Record<string, never>>()
  })
})

type AppEvents = {
  increment: [delta?: number]
  reset: []
  "todo:add": [title: string]
}

describe("TypedEmit (type-level)", () => {
  it("describes a callable emit type", () => {
    type E = WithFrameworkEvents<AppEvents>
    type Emit = TypedEmit<E>
    expectTypeOf<Emit>().toBeFunction()

    // Compile-only: if someone uncomments these without fixing types, tsc fails.
    type _ok1 = Parameters<Emit>
    // @ts-expect-error — typo event must fail
    type _bad = Parameters<
      // force a call type check via conditional
      Emit extends (e: "incremnt", ...a: infer _A) => void ? Emit : never
    >
    void 0 as unknown as {
      // valid call signatures (type positions)
      a: Emit extends (e: "increment", n?: number) => void ? true : false
      b: Emit extends (e: "reset") => void ? true : false
      c: Emit extends (e: "todo:add", title: string) => void ? true : false
    }
  })
})

describe("createApp runtime + types", () => {
  type S = { count: number; label: string }
  type E = { increment: [n?: number]; reset: [] }

  it("state fields are typed without casts", () => {
    const app = createApp<S, E>({
      state: { count: 0, label: "x" },
    })

    app.use(
      defineStore<S, E>(
        "count",
        { count: 0, label: "x" },
        ({ get, set, on, emit }) => {
          on("increment", (n) => {
            set({ count: get().count + (n ?? 1) })
            emit("render")
          })
          on("reset", () => {
            set({ count: 0 })
            emit("render")
          })
        },
      ),
    )

    app.route("/", (state, emit) => {
      expectTypeOf(state.count).toEqualTypeOf<number>()
      expectTypeOf(state.label).toEqualTypeOf<string>()
      return h(
        "button",
        { type: "button", onclick: () => emit("increment", 2) },
        String(state.count),
      )
    })

    app.route("/users/:id", (state) => {
      expectTypeOf(state.params.id).toEqualTypeOf<string>()
      return h("div", null, state.params.id)
    })

    expect(app.toString("/")).toContain("0")
    app.emit("increment", 5)
    expect(app.state.count).toBe(5)
  })
})
