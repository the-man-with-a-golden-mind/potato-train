/**
 * Shared schema helpers — re-export common drizzle builders so apps
 * can import from one place for AI-agent friendliness.
 */
export {
  sql,
  eq,
  and,
  or,
  ne,
  gt,
  gte,
  lt,
  lte,
  isNull,
  isNotNull,
  inArray,
  notInArray,
  desc,
  asc,
  relations,
} from "drizzle-orm"
