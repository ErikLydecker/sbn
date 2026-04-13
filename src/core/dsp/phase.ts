export interface PhaseBasis {
  e1: number[]
  e2: number[]
}

export interface PhaseResult {
  phases: number[]
  basis: PhaseBasis
  /** Cosine similarity between old and new 2D subspaces (1 = identical, 0 = orthogonal) */
  subspaceStability: number
}

/**
 * Extract phase angles from embedded vectors via power-iteration PCA.
 * Projects onto first two principal components and computes atan2.
 *
 * When a previous basis is provided, the new eigenvectors are aligned
 * to it (sign-correction + 2D Procrustes rotation) to prevent artificial
 * phase jumps from basis flips or gradual rotation.
 */
export function takensPhase(vecs: number[][], prevBasis?: PhaseBasis | null): PhaseResult {
  const empty: PhaseResult = { phases: [], basis: { e1: [], e2: [] }, subspaceStability: 0 }
  if (vecs.length < 4) return empty
  const n = vecs.length
  const dim = vecs[0]!.length

  const mu = new Array(dim).fill(0) as number[]
  for (const v of vecs) {
    for (let i = 0; i < dim; i++) mu[i]! += v[i]!
  }
  for (let i = 0; i < dim; i++) mu[i]! /= n

  const cen = vecs.map((v) => v.map((x, i) => x - mu[i]!))

  let e1 = powerIter(cen, dim, null)
  let e2 = powerIter(cen, dim, e1)

  let subspaceStability = 1

  if (prevBasis && prevBasis.e1.length === dim) {
    // Sign-correct each eigenvector against previous
    if (dot(e1, prevBasis.e1) < 0) e1 = e1.map((x) => -x)
    if (dot(e2, prevBasis.e2) < 0) e2 = e2.map((x) => -x)

    // 2D Procrustes: find the rotation within the new (e1,e2) plane
    // that best aligns it with the previous (e1,e2) plane.
    // M = [dot(new_e1, old_e1) + dot(new_e2, old_e2),  dot(new_e1, old_e2) - dot(new_e2, old_e1)]
    //     [dot(new_e2, old_e1) - dot(new_e1, old_e2),  dot(new_e1, old_e1) + dot(new_e2, old_e2)]
    // Optimal rotation angle theta = atan2(M[0][1], M[0][0])
    const a11 = dot(e1, prevBasis.e1) + dot(e2, prevBasis.e2)
    const a12 = dot(e1, prevBasis.e2) - dot(e2, prevBasis.e1)
    const theta = Math.atan2(a12, a11)

    if (Math.abs(theta) > 1e-6) {
      const ct = Math.cos(theta)
      const st = Math.sin(theta)
      const re1 = e1.map((_, i) => ct * e1[i]! + st * e2[i]!)
      const re2 = e1.map((_, i) => -st * e1[i]! + ct * e2[i]!)
      e1 = re1
      e2 = re2
    }

    // Subspace stability: average absolute cosine between old and new axes
    subspaceStability = (Math.abs(dot(e1, prevBasis.e1)) + Math.abs(dot(e2, prevBasis.e2))) / 2
  }

  const basis: PhaseBasis = { e1, e2 }

  const phases = cen.map((v) =>
    Math.atan2(
      v.reduce((s, x, i) => s + x * e2[i]!, 0),
      v.reduce((s, x, i) => s + x * e1[i]!, 0),
    ),
  )

  return { phases, basis, subspaceStability }
}

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
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
