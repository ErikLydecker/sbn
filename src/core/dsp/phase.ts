/**
 * Extract phase angles from embedded vectors via power-iteration PCA.
 * Projects onto first two principal components and computes atan2.
 */
export function takensPhase(vecs: number[][]): number[] {
  if (vecs.length < 4) return []
  const n = vecs.length
  const dim = vecs[0]!.length

  const mu = new Array(dim).fill(0) as number[]
  for (const v of vecs) {
    for (let i = 0; i < dim; i++) mu[i]! += v[i]!
  }
  for (let i = 0; i < dim; i++) mu[i]! /= n

  const cen = vecs.map((v) => v.map((x, i) => x - mu[i]!))

  const e1 = powerIter(cen, dim, null)
  const e2 = powerIter(cen, dim, e1)

  return cen.map((v) =>
    Math.atan2(
      v.reduce((s, x, i) => s + x * e2[i]!, 0),
      v.reduce((s, x, i) => s + x * e1[i]!, 0),
    ),
  )
}

function powerIter(
  data: number[][],
  dim: number,
  excl: number[] | null,
): number[] {
  let u = new Array(dim).fill(0) as number[]
  u[0] = 1

  for (let it = 0; it < 30; it++) {
    let w = new Array(dim).fill(0) as number[]
    for (const v of data) {
      let vv = v
      if (excl) {
        const d = v.reduce((s, x, i) => s + x * excl[i]!, 0)
        vv = v.map((x, i) => x - d * excl[i]!)
      }
      const d = vv.reduce((s, x, i) => s + x * u[i]!, 0)
      w = w.map((x, i) => x + d * vv[i]!)
    }
    const nm = Math.sqrt(w.reduce((s, x) => s + x * x, 0))
    if (nm < 1e-12) break
    u = w.map((x) => x / nm)
  }
  return u
}
