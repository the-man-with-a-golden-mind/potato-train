import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"

export type SqliteDb<TSchema extends Record<string, unknown> = Record<string, never>> =
  BetterSQLite3Database<TSchema>

export interface SqliteOptions {
  /** File path or ':memory:' */
  path: string
  schema?: Record<string, unknown>
}

/**
 * Create a Drizzle better-sqlite3 client (Node / local dev).
 */
export function createSqlite<TSchema extends Record<string, unknown>>(
  opts: SqliteOptions & { schema?: TSchema },
): SqliteDb<TSchema> {
  const sqlite = new Database(opts.path)
  sqlite.pragma("journal_mode = WAL")
  return drizzle(sqlite, { schema: opts.schema }) as SqliteDb<TSchema>
}

export {
  sqliteTable,
  text,
  integer,
  real,
  blob,
} from "drizzle-orm/sqlite-core"
