export class FormulaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FormulaError"
  }
}

export function isFormula(input: string): boolean {
  return input.trimStart().startsWith("=")
}

export function parseRef(ref: string): { col: number; row: number } {
  const m = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/)
  if (!m) throw new FormulaError(`Invalid ref: ${ref}`)
  const col = colLettersToIndex(m[1]!)
  const row = Number(m[2]) - 1
  /* v8 ignore next */
  if (row < 0) throw new FormulaError(`Invalid row: ${ref}`)
  return { col, row }
}

export function colLettersToIndex(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

export function indexToColLetters(index: number): string {
  let n = index + 1
  let s = ""
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function cellKey(col: number, row: number): string {
  return `${indexToColLetters(col)}${row + 1}`
}
