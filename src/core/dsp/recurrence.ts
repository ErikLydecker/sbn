/**
 * Recurrence analysis for Takens-embedded vectors.
 *
 * - Recurrence matrix R(i,j) = ||v_i - v_j|| < epsilon
 * - Recurrence rate (fraction of recurrence points)
 * - Correlation dimension estimate via Grassberger-Procaccia
 */

export interface RecurrenceResult {
  /** Flat row-major recurrence matrix (n x n) packed as Uint8Array */
  matrix: Uint8Array
  /** Side length of the square matrix */
  size: number
  /** Fraction of off-diagonal recurrence points (percentile-based epsilon) */
  recurrenceRate: number
  /** Fixed-scale RR: epsilon = fraction of max pairwise distance — free to vary with attractor clustering */
  fixedRecurrenceRate: number
  /** Estimated correlation dimension (slope of log C(eps) vs log eps) */
  corrDimEstimate: number
}

/**
 * Compute recurrence analysis from 3D-projected embedding vectors.
 * @param pts  Array of [x, y, z] points (already PCA-projected)
 * @param epsilonPct  Percentile of pairwise distances used as recurrence threshold (default 0.1 = 10th percentile).
 *   Using a fixed percentile rather than a fraction of the diameter makes the
 *   threshold robust to changes in attractor scale/embedding dimension (Marwan et al. 2007).
 */
/**
 * @param fixedEpsilonFrac  Fraction of maximum pairwise distance for the fixed-scale RR (default 0.10).
 *   Zbilut & Webber (1992) recommend 10-20% of max distance.
 */
export function computeRecurrence(
  pts: number[][],
  epsilonPct = 0.1,
  fixedEpsilonFrac = 0.10,
): RecurrenceResult {
  const n = pts.length
  if (n < 4) {
    return { matrix: new Uint8Array(0), size: 0, recurrenceRate: 0, fixedRecurrenceRate: 0, corrDimEstimate: 0 }
  }

  const dists = computeDistanceMatrix(pts, n)
  const maxDist = dists.reduce((mx, d) => Math.max(mx, d), 0)
  const epsilon = percentileDistance(dists, n, epsilonPct)

  const matrix = new Uint8Array(n * n)
  let recCount = 0

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (dists[i * n + j]! < epsilon) {
        matrix[i * n + j] = 1
        matrix[j * n + i] = 1
        recCount += 2
      }
    }
    matrix[i * n + i] = 1
  }

  const offDiagTotal = n * n - n
  const recurrenceRate = offDiagTotal > 0 ? recCount / offDiagTotal : 0

  const fixedEps = maxDist * fixedEpsilonFrac
  let fixedCount = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (dists[i * n + j]! < fixedEps) fixedCount++
    }
  }
  const fixedRecurrenceRate = offDiagTotal > 0 ? (fixedCount * 2) / offDiagTotal : 0

  const corrDimEstimate = estimateCorrelationDimension(dists, n, maxDist)

  return { matrix, size: n, recurrenceRate, fixedRecurrenceRate, corrDimEstimate }
}

function computeDistanceMatrix(pts: number[][], n: number): Float32Array {
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

function percentileDistance(dists: Float32Array, n: number, pct: number): number {
  const pairs: number[] = []
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      pairs.push(dists[i * n + j]!)
  if (pairs.length === 0) return 0
  pairs.sort((a, b) => a - b)
  return pairs[Math.floor(pairs.length * pct)] ?? pairs[pairs.length - 1]!
}

/**
 * Grassberger-Procaccia correlation dimension via log-log regression
 * of C(eps) = (2 / N(N-1)) * #{(i,j) : ||v_i - v_j|| < eps}.
 */
function estimateCorrelationDimension(
  dists: Float32Array,
  n: number,
  maxDist: number,
): number {
  if (n < 10 || maxDist < 1e-12) return 0

  const steps = 20
  const logEps: number[] = []
  const logC: number[] = []
  const pairs = (n * (n - 1)) / 2

  for (let s = 0; s < steps; s++) {
    const frac = 0.02 + (s / (steps - 1)) * 0.48
    const eps = maxDist * frac
    let count = 0
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (dists[i * n + j]! < eps) count++
      }
    }
    const c = count / pairs
    if (c > 0) {
      logEps.push(Math.log(eps))
      logC.push(Math.log(c))
    }
  }

  if (logEps.length < 5) return 0

  const midStart = Math.floor(logEps.length * 0.25)
  const midEnd = Math.floor(logEps.length * 0.75)
  const xs = logEps.slice(midStart, midEnd)
  const ys = logC.slice(midStart, midEnd)

  return linearSlope(xs, ys)
}

function linearSlope(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  let sx = 0, sy = 0, sxx = 0, sxy = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]!
    sy += ys[i]!
    sxx += xs[i]! * xs[i]!
    sxy += xs[i]! * ys[i]!
  }
  const denom = n * sxx - sx * sx
  if (Math.abs(denom) < 1e-12) return 0
  return (n * sxy - sx * sy) / denom
}
