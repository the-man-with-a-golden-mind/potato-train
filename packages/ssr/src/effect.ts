import { Context, Effect, Layer } from "effect"
import type { PotatoContext } from "./context.js"

/** Effect service tag for request context. */
export class PotatoRequest extends Context.Tag("potato/Request")<
  PotatoRequest,
  PotatoContext
>() {}

/** Run an Effect API handler with request context provided. */
export function effectHandler<A, E>(
  program: Effect.Effect<A, E, PotatoRequest>,
): (ctx: PotatoContext) => Promise<Response | A> {
  return async (ctx) => {
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(Layer.succeed(PotatoRequest, ctx))),
    )
    return result
  }
}

/** Read JSON body as Effect. */
export const readJson = <T = unknown>(): Effect.Effect<T, Error, PotatoRequest> =>
  Effect.gen(function* () {
    const ctx = yield* PotatoRequest
    return yield* Effect.tryPromise({
      try: () => ctx.req.json() as Promise<T>,
      /* v8 ignore next */
      catch: (e) => (e instanceof Error ? e : new Error(String(e))),
    })
  })
