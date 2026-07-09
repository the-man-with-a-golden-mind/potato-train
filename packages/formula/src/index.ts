/**
 * Minimal spreadsheet formula DSL.
 *
 * Supports:
 *   numbers, strings, cell refs (A1, B12), ranges (A1:B10)
 *   + - * / ^ ( ), comparisons
 *   SUM, AVG, MIN, MAX, COUNT, IF, ABS, ROUND, CONCAT
 *
 * Formulas start with `=`. Bare values are literals.
 */

export type CellValue = number | string | boolean | null
export type GetCell = (col: number, row: number) => CellValue
export type SheetValues = Map<string, CellValue> | Record<string, CellValue>

export {
  FormulaError,
  parseRef,
  colLettersToIndex,
  indexToColLetters,
  cellKey,
  isFormula,
} from "./refs.js"

import {
  FormulaError,
  parseRef,
  cellKey,
  isFormula,
} from "./refs.js"
import {
  rebuildGraph,
  dirtyClosure,
  unlinkAllDeps,
  linkDep,
  collectDependencies,
  type DepGraph,
} from "./graph.js"

export {
  createDepGraph,
  collectDependencies,
  rebuildGraph,
  dirtyClosure,
  linkDep,
  unlinkAllDeps,
  type DepGraph,
} from "./graph.js"

type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "lparen" }
  | { t: "rparen" }
  | { t: "comma" }
  | { t: "colon" }

function tokenize(input: string): Tok[] {
  const s = input.trim()
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === "(") {
      out.push({ t: "lparen" })
      i++
      continue
    }
    if (c === ")") {
      out.push({ t: "rparen" })
      i++
      continue
    }
    if (c === ",") {
      out.push({ t: "comma" })
      i++
      continue
    }
    if (c === ":") {
      out.push({ t: "colon" })
      i++
      continue
    }
    if ("+-*/^<>=".includes(c)) {
      if ((c === "<" || c === ">" || c === "=") && s[i + 1] === "=") {
        out.push({ t: "op", v: c + "=" })
        i += 2
        continue
      }
      if (c === "<" && s[i + 1] === ">") {
        out.push({ t: "op", v: "<>" })
        i += 2
        continue
      }
      out.push({ t: "op", v: c })
      i++
      continue
    }
    if (c === '"' || c === "'") {
      const q = c
      i++
      let str = ""
      while (i < s.length && s[i] !== q) {
        str += s[i]
        i++
      }
      i++ // close
      out.push({ t: "str", v: str })
      continue
    }
    if (/[0-9.]/.test(c)) {
      let num = ""
      while (i < s.length && /[0-9.]/.test(s[i]!)) {
        num += s[i]
        i++
      }
      out.push({ t: "num", v: Number(num) })
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let id = ""
      while (i < s.length && /[A-Za-z0-9_]/.test(s[i]!)) {
        id += s[i]
        i++
      }
      out.push({ t: "id", v: id })
      continue
    }
    throw new FormulaError(`Unexpected char: ${c}`)
  }
  return out
}

type Node =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "ref"; col: number; row: number }
  | { k: "range"; c1: number; r1: number; c2: number; r2: number }
  | { k: "call"; name: string; args: Node[] }
  | { k: "bin"; op: string; l: Node; r: Node }
  | { k: "un"; op: string; x: Node }

class Parser {
  private i = 0
  constructor(private tokens: Tok[]) {}

  parse(): Node {
    const n = this.expr()
    if (this.i < this.tokens.length) {
      throw new FormulaError("Unexpected trailing tokens")
    }
    return n
  }

  private peek(): Tok | undefined {
    return this.tokens[this.i]
  }

  private eat(t?: Tok["t"], v?: string): Tok {
    const tok = this.tokens[this.i]
    if (!tok) throw new FormulaError("Unexpected end")
    if (t && tok.t !== t) throw new FormulaError(`Expected ${t}`)
    if (v && "v" in tok && tok.v !== v) throw new FormulaError(`Expected ${v}`)
    this.i++
    return tok
  }

  private expr(): Node {
    return this.compare()
  }

  private compare(): Node {
    let left = this.add()
    while (this.peek()?.t === "op" && ["<", ">", "<=", ">=", "=", "<>"].includes((this.peek() as { v: string }).v)) {
      const op = (this.eat("op") as { v: string }).v
      const right = this.add()
      left = { k: "bin", op, l: left, r: right }
    }
    return left
  }

  private add(): Node {
    let left = this.mul()
    while (this.peek()?.t === "op" && ["+", "-"].includes((this.peek() as { v: string }).v)) {
      const op = (this.eat("op") as { v: string }).v
      const right = this.mul()
      left = { k: "bin", op, l: left, r: right }
    }
    return left
  }

  private mul(): Node {
    let left = this.pow()
    while (this.peek()?.t === "op" && ["*", "/"].includes((this.peek() as { v: string }).v)) {
      const op = (this.eat("op") as { v: string }).v
      const right = this.pow()
      left = { k: "bin", op, l: left, r: right }
    }
    return left
  }

  private pow(): Node {
    let left = this.unary()
    while (this.peek()?.t === "op" && (this.peek() as { v: string }).v === "^") {
      this.eat("op")
      const right = this.unary()
      left = { k: "bin", op: "^", l: left, r: right }
    }
    return left
  }

  private unary(): Node {
    if (this.peek()?.t === "op" && (this.peek() as { v: string }).v === "-") {
      this.eat("op")
      return { k: "un", op: "-", x: this.unary() }
    }
    if (this.peek()?.t === "op" && (this.peek() as { v: string }).v === "+") {
      this.eat("op")
      return this.unary()
    }
    return this.primary()
  }

  private primary(): Node {
    const tok = this.peek()
    if (!tok) throw new FormulaError("Expected expression")

    if (tok.t === "num") {
      this.i++
      return { k: "num", v: tok.v }
    }
    if (tok.t === "str") {
      this.i++
      return { k: "str", v: tok.v }
    }
    if (tok.t === "lparen") {
      this.eat("lparen")
      const n = this.expr()
      this.eat("rparen")
      return n
    }
    if (tok.t === "id") {
      const id = tok.v
      this.i++
      // function call
      if (this.peek()?.t === "lparen") {
        this.eat("lparen")
        const args: Node[] = []
        if (this.peek()?.t !== "rparen") {
          args.push(this.expr())
          while (this.peek()?.t === "comma") {
            this.eat("comma")
            args.push(this.expr())
          }
        }
        this.eat("rparen")
        return { k: "call", name: id.toUpperCase(), args }
      }
      // cell ref or range
      if (/^[A-Za-z]+\d+$/.test(id)) {
        const { col, row } = parseRef(id)
        if (this.peek()?.t === "colon") {
          this.eat("colon")
          const id2 = this.eat("id") as { t: "id"; v: string }
          const b = parseRef(id2.v)
          return {
            k: "range",
            c1: Math.min(col, b.col),
            r1: Math.min(row, b.row),
            c2: Math.max(col, b.col),
            r2: Math.max(row, b.row),
          }
        }
        return { k: "ref", col, row }
      }
      throw new FormulaError(`Unknown identifier: ${id}`)
    }
    throw new FormulaError(`Unexpected token ${tok.t}`)
  }
}

function toNum(v: CellValue): number {
  if (v == null || v === "") return 0
  if (typeof v === "number") return v
  if (typeof v === "boolean") return v ? 1 : 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function evalNode(node: Node, get: GetCell, stack: Set<string>): CellValue {
  switch (node.k) {
    case "num":
      return node.v
    case "str":
      return node.v
    case "ref": {
      const key = cellKey(node.col, node.row)
      if (stack.has(key)) throw new FormulaError(`Circular ref: ${key}`)
      stack.add(key)
      try {
        return get(node.col, node.row)
      } finally {
        stack.delete(key)
      }
    }
    case "range": {
      // ranges only valid as function args — flatten to first cell error otherwise
      throw new FormulaError("Range used outside function")
    }
    case "un":
      return -toNum(evalNode(node.x, get, stack))
    case "bin": {
      const l = evalNode(node.l, get, stack)
      const r = evalNode(node.r, get, stack)
      switch (node.op) {
        case "+":
          if (typeof l === "string" || typeof r === "string") return String(l) + String(r)
          return toNum(l) + toNum(r)
        case "-":
          return toNum(l) - toNum(r)
        case "*":
          return toNum(l) * toNum(r)
        case "/": {
          const d = toNum(r)
          if (d === 0) throw new FormulaError("#DIV/0!")
          return toNum(l) / d
        }
        case "^":
          return toNum(l) ** toNum(r)
        case "<":
          return toNum(l) < toNum(r)
        case ">":
          return toNum(l) > toNum(r)
        case "<=":
          return toNum(l) <= toNum(r)
        case ">=":
          return toNum(l) >= toNum(r)
        case "=":
          return l === r || toNum(l) === toNum(r)
        case "<>":
          return l !== r && toNum(l) !== toNum(r)
        default:
          throw new FormulaError(`Unknown op ${node.op}`)
      }
    }
    case "call": {
      const name = node.name
      const flatten = (args: Node[]): CellValue[] => {
        const out: CellValue[] = []
        for (const a of args) {
          if (a.k === "range") {
            for (let r = a.r1; r <= a.r2; r++) {
              for (let c = a.c1; c <= a.c2; c++) {
                out.push(get(c, r))
              }
            }
          } else {
            out.push(evalNode(a, get, stack))
          }
        }
        return out
      }

      if (name === "SUM") {
        return flatten(node.args).reduce<number>((a, v) => a + toNum(v), 0)
      }
      if (name === "AVG" || name === "AVERAGE") {
        const vals = flatten(node.args).map(toNum)
        if (!vals.length) return 0
        return vals.reduce((a, b) => a + b, 0) / vals.length
      }
      if (name === "MIN") {
        const vals = flatten(node.args).map(toNum)
        return vals.length ? Math.min(...vals) : 0
      }
      if (name === "MAX") {
        const vals = flatten(node.args).map(toNum)
        return vals.length ? Math.max(...vals) : 0
      }
      if (name === "COUNT") {
        return flatten(node.args).filter((v) => v != null && v !== "").length
      }
      if (name === "IF") {
        const [cond, yes, no] = node.args
        if (!cond) throw new FormulaError("IF needs condition")
        const c = evalNode(cond, get, stack)
        const truthy = c === true || (typeof c === "number" && c !== 0) || (typeof c === "string" && c !== "")
        return truthy
          ? yes
            ? evalNode(yes, get, stack)
            : true
          : no
            ? evalNode(no, get, stack)
            : false
      }
      if (name === "ABS") return Math.abs(toNum(evalNode(node.args[0]!, get, stack)))
      if (name === "ROUND") {
        const n = toNum(evalNode(node.args[0]!, get, stack))
        const d = node.args[1] ? toNum(evalNode(node.args[1], get, stack)) : 0
        const f = 10 ** d
        return Math.round(n * f) / f
      }
      if (name === "CONCAT") {
        return flatten(node.args).map(String).join("")
      }
      throw new FormulaError(`Unknown function ${name}`)
    }
  }
}

/** Evaluate a cell input. If it starts with `=`, parse as formula. */
export function evaluate(
  input: string | number | boolean | null | undefined,
  get: GetCell,
): CellValue {
  if (input == null) return null
  if (typeof input === "number" || typeof input === "boolean") return input
  const s = String(input)
  if (!s.startsWith("=")) {
    if (s === "") return null
    const n = Number(s)
    if (s.trim() !== "" && Number.isFinite(n) && /^-?\d/.test(s.trim())) return n
    return s
  }
  const body = s.slice(1)
  try {
    const ast = new Parser(tokenize(body)).parse()
    return evalNode(ast, get, new Set())
  } catch (e) {
    if (e instanceof FormulaError) return `#ERR:${e.message}`
    return `#ERR:${String(e)}`
  }
}

/** Evaluate whole sheet with raw inputs map keyed by A1. */
export function evaluateSheet(
  raw: Record<string, string>,
): Record<string, CellValue> {
  const cache = new Map<string, CellValue>()
  const visiting = new Set<string>()

  const get: GetCell = (col, row) => {
    const key = cellKey(col, row)
    if (cache.has(key)) return cache.get(key)!
    if (visiting.has(key)) return `#ERR:circular`
    visiting.add(key)
    const input = raw[key] ?? ""
    const val = evaluate(input, get)
    visiting.delete(key)
    cache.set(key, val)
    return val
  }

  const out: Record<string, CellValue> = {}
  for (const key of Object.keys(raw)) {
    const { col, row } = parseRef(key)
    out[key] = get(col, row)
  }
  return out
}

// --- Incremental engine (dirty-graph) ---

export interface SheetEngine {
  raw: Record<string, string>
  values: Record<string, CellValue>
  graph: DepGraph
  setCell(key: string, value: string): string[]
  setCells(updates: Record<string, string>): string[]
  recomputeAll(): void
  getValue(key: string): CellValue
}

/**
 * Incremental sheet engine — only recomputes dirty dependents when cells change.
 */
export function createSheetEngine(
  initialRaw: Record<string, string> = {},
): SheetEngine {
  const raw: Record<string, string> = { ...initialRaw }
  const values: Record<string, CellValue> = {}
  let graph = rebuildGraph(raw)

  const get: GetCell = (col, row) => {
    const key = cellKey(col, row)
    if (key in values) return values[key]!
    const input = raw[key] ?? ""
    const v = evaluate(input, get)
    values[key] = v
    return v
  }

  function recomputeKeys(keys: Iterable<string>): void {
    for (const k of keys) delete values[k.toUpperCase()]
    for (const k of keys) {
      const key = k.toUpperCase()
      try {
        const { col, row } = parseRef(key)
        get(col, row)
      } catch {
        /* skip invalid keys */
      }
    }
  }

  function recomputeAll(): void {
    for (const k of Object.keys(values)) delete values[k]
    graph = rebuildGraph(raw)
    for (const key of Object.keys(raw)) {
      try {
        const { col, row } = parseRef(key)
        get(col, row)
      } catch {
        /* */
      }
    }
  }

  recomputeAll()

  return {
    raw,
    values,
    get graph() {
      return graph
    },
    setCell(key, value) {
      return this.setCells({ [key]: value })
    },
    setCells(updates) {
      const changed: string[] = []
      for (const [k, v] of Object.entries(updates)) {
        const key = k.toUpperCase()
        changed.push(key)
        unlinkAllDeps(graph, key)
        if (v === "") {
          delete raw[key]
          delete values[key]
        } else {
          raw[key] = v
          for (const d of collectDependencies(v)) linkDep(graph, key, d)
        }
      }
      const dirty = dirtyClosure(graph, changed)
      for (const c of changed) dirty.add(c)
      recomputeKeys(dirty)
      return [...dirty]
    },
    recomputeAll,
    getValue(key) {
      const k = key.toUpperCase()
      if (k in values) return values[k]!
      try {
        const { col, row } = parseRef(k)
        return get(col, row)
      } catch {
        return null
      }
    },
  }
}

// silence unused if tree-shaken wrong
void isFormula

