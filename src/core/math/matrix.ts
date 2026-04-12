export function matVec(M: number[][], v: number[]): number[] {
  return M.map((row) => row.reduce((s, x, j) => s + x * (v[j] ?? 0), 0))
}

export function matInv(M: number[][]): number[][] {
  const n = M.length
  const A = M.map((r) => r.slice())
  const I = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  )

  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row]![col]!) > Math.abs(A[maxRow]![col]!)) {
        maxRow = row
      }
    }
    ;[A[col], A[maxRow]] = [A[maxRow]!, A[col]!]
    ;[I[col], I[maxRow]] = [I[maxRow]!, I[col]!]

    const piv = A[col]![col]!
    if (Math.abs(piv) < 1e-12) continue

    for (let j = 0; j < n; j++) {
      A[col]![j]! /= piv
      I[col]![j]! /= piv
    }
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const f = A[row]![col]!
      for (let j = 0; j < n; j++) {
        A[row]![j]! -= f * A[col]![j]!
        I[row]![j]! -= f * I[col]![j]!
      }
    }
  }
  return I
}
