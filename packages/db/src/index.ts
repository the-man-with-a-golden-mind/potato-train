import type { Middleware, PotatoContext } from "@potato/ssr"
import { Context, Effect } from "effect"

/**
 * Generic DB bag on request locals.
 * Concrete clients: @potato/db/postgres | sqlite | d1
 */
export type DbClient = unknown

export class PotatoDb extends Context.Tag("potato/Db")<
  PotatoDb,
  DbClient
>() {}

/** Attach a db instance (or factory) to every request. */
export function dbMiddleware(
  db: DbClient | ((ctx: PotatoContext) => DbClient | Promise<DbClient>),
): Middleware {
  return async (ctx, next) => {
    ctx.locals.db = typeof db === "function" ? await db(ctx) : db
    return next()
  }
}

export function getDb<T = DbClient>(ctx: PotatoContext): T {
  const db = ctx.locals.db
  if (db == null) throw new Error("[potato/db] no db on context — add dbMiddleware")
  return db as T
}

export const dbEffect = <T = DbClient>(): Effect.Effect<T, Error, never> =>
  Effect.sync(() => {
    throw new Error("Use with PotatoRequest + getDb in handler context")
  })

export * from "./schema-helpers.js"
