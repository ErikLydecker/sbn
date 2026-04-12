export function normalize(a: number[]): number[] {
  const n = a.length
  if (n === 0) return []

  const mu = a.reduce((s, v) => s + v, 0) / n
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - mu) ** 2, 0) / n)

  if (sd < 1e-12) return new Array(n).fill(0) as number[]
  return a.map((v) => (v - mu) / sd)
}
