/**
 * Shallow + one-level deep diff for plain app state.
 * Skips functions, cache, and huge non-enumerable junk.
 */

const SKIP = new Set(["cache", "events"])

export type DiffEntry = {
  path: string
  kind: "add" | "remove" | "change"
  from?: unknown
  to?: unknown
}

export function snapshotState(state: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(state)) {
    if (SKIP.has(key)) continue
    const v = state[key]
    if (typeof v === "function") continue
    try {
      out[key] = structuredCloneSafe(v)
    } catch {
      out[key] = summarize(v)
    }
  }
  return out
}

function structuredCloneSafe(v: unknown): unknown {
  if (v == null) return v
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(v)
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(v)) as unknown
}

function summarize(v: unknown): unknown {
  if (v == null) return v
  if (Array.isArray(v)) return `[Array(${v.length})]`
  if (typeof v === "object") return `[Object ${Object.keys(v as object).length} keys]`
  return String(v)
}

export function diffState(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): DiffEntry[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const diffs: DiffEntry[] = []
  for (const key of keys) {
    if (SKIP.has(key)) continue
    const a = before[key]
    const b = after[key]
    if (!(key in before)) {
      diffs.push({ path: key, kind: "add", to: b })
      continue
    }
    if (!(key in after)) {
      diffs.push({ path: key, kind: "remove", from: a })
      continue
    }
    if (!deepEqual(a, b)) {
      // one level nested for plain objects
      if (
        a &&
        b &&
        typeof a === "object" &&
        typeof b === "object" &&
        !Array.isArray(a) &&
        !Array.isArray(b)
      ) {
        const nested = diffState(
          a as Record<string, unknown>,
          b as Record<string, unknown>,
        )
        if (nested.length && nested.length < 20) {
          for (const n of nested) {
            diffs.push({ ...n, path: `${key}.${n.path}` })
          }
          continue
        }
      }
      diffs.push({ path: key, kind: "change", from: a, to: b })
    }
  }
  return diffs
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export function formatDiff(diffs: DiffEntry[]): string {
  if (!diffs.length) return "(no state change)"
  return diffs
    .map((d) => {
      if (d.kind === "add") return `+ ${d.path}: ${preview(d.to)}`
      if (d.kind === "remove") return `- ${d.path}: ${preview(d.from)}`
      return `~ ${d.path}: ${preview(d.from)} → ${preview(d.to)}`
    })
    .join("\n")
}

function preview(v: unknown, max = 80): string {
  try {
    const s = JSON.stringify(v)
    if (s == null) return String(v)
    return s.length > max ? s.slice(0, max) + "…" : s
  } catch {
    return String(v)
  }
}
