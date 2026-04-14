/**
 * Lightweight persistent homology approximation via Betti curve sweep.
 *
 * Instead of full Rips-complex TDA, we sweep distance thresholds and compute:
 * - H0 (connected components) via union-find
 * - H1 (loops) approximated via Euler characteristic: edges - vertices + components
 */

export interface BettiCurves {
  /** H0 values at each threshold (component count, starts at n, ends at 1) */
  h0: number[]
  /** H1 proxy values at each threshold */
  h1: number[]
  /** Threshold values used */
  thresholds: number[]
}

export interface PersistenceFeatures {
  /** Normalized area under the Betti-0 curve */
  h0Persistence: number
  /** Maximum of the Betti-1 proxy curve */
  h1Peak: number
  /** Normalized area under the Betti-1 proxy curve */
  h1Persistence: number
  /** Rate of decrease of H0 at the steepest point (knee) */
  fragmentationRate: number
  /** Raw Betti curves for visualization */
  bettiCurves: BettiCurves
}

class UnionFind {
  parent: Int32Array
  rank: Uint8Array
  components: number

  constructor(n: number) {
    this.parent = new Int32Array(n)
    this.rank = new Uint8Array(n)
    this.components = n
    for (let i = 0; i < n; i++) this.parent[i] = i
  }

  find(x: number): number {
    let r = x
    while (this.parent[r]! !== r) r = this.parent[r]!
    while (this.parent[x]! !== r) {
      const next = this.parent[x]!
      this.parent[x] = r
      x = next
    }
    return r
  }

  union(a: number, b: number): boolean {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return false
    if (this.rank[ra]! < this.rank[rb]!) {
      this.parent[ra] = rb
    } else if (this.rank[ra]! > this.rank[rb]!) {
      this.parent[rb] = ra
    } else {
      this.parent[rb] = ra
      this.rank[ra]!++
    }
    this.components--
    return true
  }
}

/**
 * Compute persistence features from a pairwise distance matrix.
 * Reuses the distance matrix already computed for recurrence analysis.
 *
 * @param dists  Flat row-major distance matrix (n x n)
 * @param n      Side length
 * @param steps  Number of threshold steps to sweep
 */
export function computePersistence(
  dists: Float32Array,
  n: number,
  steps = 20,
): PersistenceFeatures {
  if (n < 4) {
    return {
      h0Persistence: 0, h1Peak: 0, h1Persistence: 0, fragmentationRate: 0,
      bettiCurves: { h0: [], h1: [], thresholds: [] },
    }
  }

  // Collect and sort all unique pairwise distances for threshold selection
  let maxDist = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = dists[i * n + j]!
      if (d > maxDist) maxDist = d
    }
  }
  if (maxDist < 1e-12) {
    return {
      h0Persistence: 0, h1Peak: 0, h1Persistence: 0, fragmentationRate: 0,
      bettiCurves: { h0: [], h1: [], thresholds: [] },
    }
  }

  // Sort edges by distance for incremental union-find
  const edgeCount = (n * (n - 1)) / 2
  const edges = new Float32Array(edgeCount * 3) // [dist, i, j]
  let ei = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      edges[ei * 3] = dists[i * n + j]!
      edges[ei * 3 + 1] = i
      edges[ei * 3 + 2] = j
      ei++
    }
  }

  // Sort edges by distance (index-based sort)
  const indices = new Uint32Array(edgeCount)
  for (let i = 0; i < edgeCount; i++) indices[i] = i
  indices.sort((a, b) => edges[a * 3]! - edges[b * 3]!)

  const thresholds: number[] = []
  const h0: number[] = []
  const h1: number[] = []

  const uf = new UnionFind(n)
  let edgePtr = 0
  let edgesAdded = 0

  for (let s = 0; s < steps; s++) {
    const eps = maxDist * ((s + 1) / steps)
    thresholds.push(eps)

    while (edgePtr < edgeCount && edges[indices[edgePtr]! * 3]! < eps) {
      const idx = indices[edgePtr]!
      const a = edges[idx * 3 + 1]!
      const b = edges[idx * 3 + 2]!
      uf.union(a, b)
      edgePtr++
      edgesAdded++
    }

    const components = uf.components
    const vertices = n
    // Euler characteristic proxy for H1: edges - vertices + components
    const h1Proxy = Math.max(0, edgesAdded - vertices + components)

    h0.push(components)
    h1.push(h1Proxy)
  }

  // Normalize H0 persistence: area under curve / (n * steps)
  let h0Area = 0
  for (let i = 0; i < h0.length; i++) h0Area += h0[i]!
  const h0Persistence = (h0Area / (n * steps))

  // H1 features
  let h1Peak = 0, h1Area = 0
  for (let i = 0; i < h1.length; i++) {
    if (h1[i]! > h1Peak) h1Peak = h1[i]!
    h1Area += h1[i]!
  }
  // Normalize H1 persistence by edge count to keep in reasonable range
  const h1Persistence = edgeCount > 0 ? h1Area / (edgeCount * steps) : 0

  // Fragmentation rate: steepest drop in H0 between consecutive thresholds
  let maxDrop = 0
  for (let i = 1; i < h0.length; i++) {
    const drop = h0[i - 1]! - h0[i]!
    if (drop > maxDrop) maxDrop = drop
  }
  const fragmentationRate = n > 1 ? maxDrop / (n - 1) : 0

  return {
    h0Persistence,
    h1Peak,
    h1Persistence,
    fragmentationRate,
    bettiCurves: { h0, h1, thresholds },
  }
}

/**
 * Build pairwise distance matrix (reusable if recurrence hasn't already computed one).
 */
export function buildDistanceMatrix(pts: number[][]): Float32Array {
  const n = pts.length
  const dists = new Float32Array(n * n)
  for (let i = 0; i < n; i++) {
    const pi = pts[i]!
    for (let j = i + 1; j < n; j++) {
      const pj = pts[j]!
      let s = 0
      for (let d = 0; d < pi.length; d++) {
        const diff = pi[d]! - pj[d]!
        s += diff * diff
      }
      const dist = Math.sqrt(s)
      dists[i * n + j] = dist
      dists[j * n + i] = dist
    }
  }
  return dists
}
