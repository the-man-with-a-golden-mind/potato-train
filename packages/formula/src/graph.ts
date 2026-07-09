import {
  cellKey,
  colLettersToIndex,
  indexToColLetters,
  parseRef,
  isFormula,
} from "./refs.js"

/**
 * Dependency graph + dirty-set computation for incremental recompute.
 */

export type DepGraph = {
  /** cell → cells it reads */
  deps: Map<string, Set<string>>
  /** cell → cells that read it (reverse) */
  dependents: Map<string, Set<string>>
}

export function createDepGraph(): DepGraph {
  return { deps: new Map(), dependents: new Map() }
}

export function linkDep(graph: DepGraph, from: string, to: string): void {
  const f = from.toUpperCase()
  const t = to.toUpperCase()
  if (!graph.deps.has(f)) graph.deps.set(f, new Set())
  graph.deps.get(f)!.add(t)
  if (!graph.dependents.has(t)) graph.dependents.set(t, new Set())
  graph.dependents.get(t)!.add(f)
}

export function unlinkAllDeps(graph: DepGraph, from: string): void {
  const f = from.toUpperCase()
  const deps = graph.deps.get(f)
  if (!deps) return
  for (const to of deps) {
    graph.dependents.get(to)?.delete(f)
  }
  graph.deps.delete(f)
}

/** Collect refs and range cells read by a formula string */
export function collectDependencies(formula: string): Set<string> {
  const found = new Set<string>()
  if (!isFormula(formula)) return found
  const body = formula.slice(1).toUpperCase()
  const re = /\b([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    if (m[3] && m[4]) {
      const a = parseRef(m[1]! + m[2]!)
      const b = parseRef(m[3] + m[4])
      const c1 = Math.min(a.col, b.col)
      const c2 = Math.max(a.col, b.col)
      const r1 = Math.min(a.row, b.row)
      const r2 = Math.max(a.row, b.row)
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          found.add(cellKey(c, r))
        }
      }
    } else {
      found.add((m[1]! + m[2]!).toUpperCase())
    }
  }
  return found
}

export function rebuildGraph(raw: Record<string, string>): DepGraph {
  const graph = createDepGraph()
  for (const [key, input] of Object.entries(raw)) {
    const k = key.toUpperCase()
    for (const d of collectDependencies(input)) linkDep(graph, k, d)
  }
  return graph
}

/** All cells that must recompute when `changed` keys change */
export function dirtyClosure(
  graph: DepGraph,
  changed: Iterable<string>,
): Set<string> {
  const dirty = new Set<string>()
  const queue = [...changed].map((c) => c.toUpperCase())
  while (queue.length) {
    const k = queue.pop()!
    if (dirty.has(k)) continue
    dirty.add(k)
    const deps = graph.dependents.get(k)
    if (deps) for (const d of deps) queue.push(d)
  }
  return dirty
}

// re-export refs used by engine for convenience
export {
  cellKey,
  colLettersToIndex,
  indexToColLetters,
  parseRef,
  isFormula,
}
