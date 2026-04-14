/**
 * Discrete differential geometry on 3D point sequences.
 *
 * - Menger curvature from consecutive triplets
 * - Discrete torsion from consecutive quadruplets
 * - Profile statistics (mean, max, variance, skewness, energy, concentration)
 */

export interface CurvatureProfile {
  /** Per-point curvature values (length = n-2 for n points) */
  kappa: number[]
  /** Per-point torsion values (length = n-3 for n points) */
  tau: number[]
}

export interface CurvatureStats {
  meanCurvature: number
  maxCurvature: number
  curvatureVariance: number
  curvatureSkewness: number
  curvatureEnergy: number
  curvatureConcentration: number
  meanTorsion: number
  torsionEnergy: number
}

function cross3(a: number[], b: number[]): [number, number, number] {
  return [
    a[1]! * b[2]! - a[2]! * b[1]!,
    a[2]! * b[0]! - a[0]! * b[2]!,
    a[0]! * b[1]! - a[1]! * b[0]!,
  ]
}

function norm3(v: number[]): number {
  return Math.sqrt(v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]!)
}

function sub3(a: number[], b: number[]): [number, number, number] {
  return [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!]
}

function dot3(a: number[], b: number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
}

/**
 * Menger curvature at point p1 given neighbours p0, p2.
 * kappa = 2 |cross(p1-p0, p2-p0)| / (|p1-p0| * |p2-p1| * |p2-p0|)
 */
function mengerCurvature(p0: number[], p1: number[], p2: number[]): number {
  const a = sub3(p1, p0)
  const b = sub3(p2, p0)
  const c = sub3(p2, p1)
  const crossAB = cross3(a, b)
  const crossMag = norm3(crossAB)
  const la = norm3(a)
  const lb = norm3(c)
  const lc = norm3(b)
  const denom = la * lb * lc
  if (denom < 1e-15) return 0
  return (2 * crossMag) / denom
}

/**
 * Discrete torsion at point p1 from four consecutive points p0..p3.
 * Uses the formula: tau = dot(cross(e1,e2), cross(e2,e3)) / |cross(e1,e2)| / |cross(e2,e3)|
 * where e_i = p_{i+1} - p_i, measuring how much the osculating plane rotates.
 */
function discreteTorsion(p0: number[], p1: number[], p2: number[], p3: number[]): number {
  const e1 = sub3(p1, p0)
  const e2 = sub3(p2, p1)
  const e3 = sub3(p3, p2)
  const n1 = cross3(e1, e2)
  const n2 = cross3(e2, e3)
  const n1mag = norm3(n1)
  const n2mag = norm3(n2)
  if (n1mag < 1e-15 || n2mag < 1e-15) return 0
  const e2mag = norm3(e2)
  if (e2mag < 1e-15) return 0
  const num = dot3(n1, n2)
  return Math.atan2(norm3(cross3(n1, n2)), num) / e2mag
}

/**
 * Compute discrete curvature and torsion profiles along a 3D point sequence.
 */
export function computeCurvatureProfile(pts: number[][]): CurvatureProfile {
  const n = pts.length
  const kappa: number[] = []
  const tau: number[] = []

  for (let i = 1; i < n - 1; i++) {
    kappa.push(mengerCurvature(pts[i - 1]!, pts[i]!, pts[i + 1]!))
  }

  for (let i = 1; i < n - 2; i++) {
    tau.push(discreteTorsion(pts[i - 1]!, pts[i]!, pts[i + 1]!, pts[i + 2]!))
  }

  return { kappa, tau }
}

/**
 * Compute summary statistics from curvature and torsion profiles.
 */
export function computeCurvatureStats(profile: CurvatureProfile): CurvatureStats {
  const { kappa, tau } = profile

  if (kappa.length === 0) {
    return {
      meanCurvature: 0, maxCurvature: 0, curvatureVariance: 0,
      curvatureSkewness: 0, curvatureEnergy: 0, curvatureConcentration: 0,
      meanTorsion: 0, torsionEnergy: 0,
    }
  }

  const n = kappa.length
  let sum = 0, maxK = 0, sumSq = 0
  for (let i = 0; i < n; i++) {
    const k = kappa[i]!
    sum += k
    sumSq += k * k
    if (k > maxK) maxK = k
  }
  const meanCurvature = sum / n
  const curvatureEnergy = sumSq

  let varSum = 0
  for (let i = 0; i < n; i++) {
    const d = kappa[i]! - meanCurvature
    varSum += d * d
  }
  const curvatureVariance = varSum / n

  const std = Math.sqrt(curvatureVariance)
  let skewSum = 0
  if (std > 1e-12) {
    for (let i = 0; i < n; i++) {
      const d = (kappa[i]! - meanCurvature) / std
      skewSum += d * d * d
    }
  }
  const curvatureSkewness = std > 1e-12 ? skewSum / n : 0

  // Concentration: fraction of total curvature in the top quartile of points
  const sorted = [...kappa].sort((a, b) => b - a)
  const topQuartileCount = Math.max(1, Math.floor(n / 4))
  let topSum = 0
  for (let i = 0; i < topQuartileCount; i++) topSum += sorted[i]!
  const curvatureConcentration = sum > 1e-12 ? topSum / sum : 0

  let tauSum = 0, tauSqSum = 0
  for (let i = 0; i < tau.length; i++) {
    tauSum += tau[i]!
    tauSqSum += tau[i]! * tau[i]!
  }
  const meanTorsion = tau.length > 0 ? tauSum / tau.length : 0
  const torsionEnergy = tauSqSum

  return {
    meanCurvature, maxCurvature: maxK, curvatureVariance,
    curvatureSkewness, curvatureEnergy, curvatureConcentration,
    meanTorsion, torsionEnergy,
  }
}
