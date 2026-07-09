import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1"
import type { Middleware, PotatoContext } from "@potato/ssr"

export type D1Db<TSchema extends Record<string, unknown> = Record<string, never>> =
  DrizzleD1Database<TSchema>

/** Minimal D1Database typing so we don't require @cloudflare/workers-types. */
export interface D1Database {
  prepare(query: string): unknown
  dump(): Promise<ArrayBuffer>
  batch<T = unknown>(statements: unknown[]): Promise<T[]>
  exec(query: string): Promise<unknown>
}

export interface D1Options<TSchema extends Record<string, unknown> = Record<string, never>> {
  schema?: TSchema
}

/**
 * Wrap a Cloudflare D1 binding with Drizzle.
 */
export function createD1<TSchema extends Record<string, unknown>>(
  d1: D1Database,
  opts: D1Options<TSchema> = {},
): D1Db<TSchema> {
  return drizzle(d1 as never, { schema: opts.schema }) as D1Db<TSchema>
}

/**
 * Middleware that reads D1 from Cloudflare env binding.
 * @example server.use(d1Middleware('DB', { schema }))
 */
export function d1Middleware<TSchema extends Record<string, unknown>>(
  bindingName = "DB",
  opts: D1Options<TSchema> = {},
): Middleware {
  return async (ctx, next) => {
    const binding = ctx.env[bindingName] as D1Database | undefined
    if (!binding) {
      throw new Error(`[potato/db] D1 binding '${bindingName}' missing on env`)
    }
    ctx.locals.db = createD1(binding, opts)
    return next()
  }
}

/** Helper for worker fetch: env.DB */
export function d1FromEnv<TSchema extends Record<string, unknown>>(
  env: Record<string, unknown>,
  bindingName = "DB",
  opts: D1Options<TSchema> = {},
): D1Db<TSchema> {
  const binding = env[bindingName] as D1Database
  if (!binding) throw new Error(`[potato/db] missing env.${bindingName}`)
  return createD1(binding, opts)
}

export {
  sqliteTable,
  text,
  integer,
  real,
  blob,
} from "drizzle-orm/sqlite-core"
