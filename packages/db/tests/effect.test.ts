import { describe, expect, it } from "vitest"
import { dbEffect } from "../src/index.js"
import { Effect } from "effect"

describe("dbEffect", () => {
  it("throws when used without context", async () => {
    await expect(
      Effect.runPromise(dbEffect()),
    ).rejects.toThrow(/PotatoRequest|getDb|no db|throw/i)
  })
})
