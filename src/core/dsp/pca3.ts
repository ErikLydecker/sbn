/**
 * Project m-dimensional embedding vectors onto 3 principal components
 * via successive power-iteration with deflation.
 */
export function pcaProject3(vecs: number[][]): number[][] {
  if (vecs.length < 4) return []
  const n = vecs.length
  const dim = vecs[0]!.length

  const mu = new Array(dim).fill(0) as number[]
  for (const v of vecs) {
    for (let i = 0; i < dim; i++) mu[i]! += v[i]!
  }
  for (let i = 0; i < dim; i++) mu[i]! /= n

  const cen = vecs.map((v) => v.map((x, i) => x - mu[i]!))

  const e1 = powerIter(cen, dim, [])
  const e2 = powerIter(cen, dim, [e1])
  const e3 = dim > 2 ? powerIter(cen, dim, [e1, e2]) : zeroVec(dim)

  return cen.map((v) => [
    dot(v, e1),
    dot(v, e2),
    dot(v, e3),
  ])
}

function powerIter(
  data: number[][],
  dim: number,
  excl: number[][],
): number[] {
  let u = new Array(dim).fill(0) as number[]
  u[0] = 1

  for (let it = 0; it < 40; it++) {
    let w = new Array(dim).fill(0) as number[]
    for (const v of data) {
      let vv = v
      for (const e of excl) {
        const d = dot(vv, e)
        vv = vv.map((x, i) => x - d * e[i]!)
      }
      const d = dot(vv, u)
      w = w.map((x, i) => x + d * vv[i]!)
    }
    const nm = Math.sqrt(w.reduce((s, x) => s + x * x, 0))
    if (nm < 1e-12) break
    u = w.map((x) => x / nm)
  }
  return u
}

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
}

function zeroVec(dim: number): number[] {
  return new Array(dim).fill(0) as number[]
}
