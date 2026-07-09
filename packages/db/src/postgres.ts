import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"

export type PostgresDb<TSchema extends Record<string, unknown> = Record<string, never>> =
  PostgresJsDatabase<TSchema>

export interface PostgresOptions {
  connectionString: string
  /** Max connections (node). Default 10 */
  max?: number
  schema?: Record<string, unknown>
}

/**
 * Create a Drizzle Postgres client.
 * @example
 * ```ts
 * const db = createPostgres({ connectionString: process.env.DATABASE_URL! })
 * server.use(dbMiddleware(db))
 * ```
 */
export function createPostgres<TSchema extends Record<string, unknown>>(
  opts: PostgresOptions & { schema?: TSchema },
): PostgresDb<TSchema> {
  const client = postgres(opts.connectionString, { max: opts.max ?? 10 })
  return drizzle(client, { schema: opts.schema }) as PostgresDb<TSchema>
}

export { pgTable, serial, text, varchar, timestamp, integer, boolean, uuid, jsonb } from "drizzle-orm/pg-core"
