/**
 * Turn morphology signature: rotation/translation/scale-invariant shape descriptors.
 *
 * - Arc-length reparameterization of 3D curves
 * - Curvature signature along normalized arc-length
 * - Low-order Fourier descriptors of the curvature signature
 * - Morphology distance for "does this turn rhyme?" matching
 */

import { computeCurvatureProfile } from './curvature'

export interface MorphologySignature {
  /** Curvature values at uniformly-spaced arc-length positions */
  curvatureSignature: number[]
  /** Fourier descriptor magnitudes (first numHarmonics harmonics) */
  fourierDescriptors: number[]
}

/**
 * Compute cumulative arc-length along a 3D point sequence.
 */
function cumulativeArcLength(pts: number[][]): number[] {
  const s = [0]
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[i - 1]!
    let d2 = 0
    for (let d = 0; d < p.length; d++) {
      const diff = p[d]! - q[d]!
      d2 += diff * diff
    }
    s.push(s[s.length - 1]! + Math.sqrt(d2))
  }
  return s
}

/**
 * Resample a 3D trajectory to uniform arc-length spacing via linear interpolation.
 */
function resampleUniformArcLength(pts: number[][], numSamples: number): number[][] {
  if (pts.length < 2) return pts
  const s = cumulativeArcLength(pts)
  const totalLen = s[s.length - 1]!
  if (totalLen < 1e-12) return pts.slice(0, numSamples)

  const result: number[][] = []
  let srcIdx = 0

  for (let i = 0; i < numSamples; i++) {
    const target = (i / (numSamples - 1)) * totalLen

    while (srcIdx < s.length - 2 && s[srcIdx + 1]! < target) srcIdx++

    const segLen = s[srcIdx + 1]! - s[srcIdx]!
    const t = segLen > 1e-15 ? (target - s[srcIdx]!) / segLen : 0
    const p0 = pts[srcIdx]!
    const p1 = pts[Math.min(srcIdx + 1, pts.length - 1)]!
    const interp: number[] = []
    for (let d = 0; d < p0.length; d++) {
      interp.push(p0[d]! * (1 - t) + p1[d]! * t)
    }
    result.push(interp)
  }

  return result
}

/**
 * Compute low-order Fourier descriptor magnitudes of a real signal.
 * Returns the first numHarmonics amplitude coefficients (excluding DC).
 */
function fourierDescriptors(signal: number[], numHarmonics: number): number[] {
  const n = signal.length
  if (n < 2) return new Array(numHarmonics).fill(0) as number[]

  const descriptors: number[] = []
  for (let k = 1; k <= numHarmonics; k++) {
    let re = 0, im = 0
    const freq = (2 * Math.PI * k) / n
    for (let i = 0; i < n; i++) {
      re += signal[i]! * Math.cos(freq * i)
      im -= signal[i]! * Math.sin(freq * i)
    }
    re /= n
    im /= n
    descriptors.push(Math.sqrt(re * re + im * im))
  }

  // Normalize so descriptors are scale-invariant
  let maxMag = 0
  for (const d of descriptors) if (d > maxMag) maxMag = d
  if (maxMag > 1e-12) {
    for (let i = 0; i < descriptors.length; i++) {
      descriptors[i] = descriptors[i]! / maxMag
    }
  }

  return descriptors
}

/**
 * Compute the morphology signature of a 3D trajectory.
 *
 * @param pts          3D point sequence (PCA-projected embedding)
 * @param numSamples   Number of uniform arc-length samples (default 32)
 * @param numHarmonics Number of Fourier harmonics to extract (default 8)
 */
export function computeMorphologySignature(
  pts: number[][],
  numSamples = 32,
  numHarmonics = 8,
): MorphologySignature {
  if (pts.length < 4) {
    return {
      curvatureSignature: new Array(numSamples).fill(0) as number[],
      fourierDescriptors: new Array(numHarmonics).fill(0) as number[],
    }
  }

  const resampled = resampleUniformArcLength(pts, numSamples + 2)
  const profile = computeCurvatureProfile(resampled)
  const curvatureSignature = profile.kappa

  // Pad or truncate to numSamples
  while (curvatureSignature.length < numSamples) curvatureSignature.push(0)
  if (curvatureSignature.length > numSamples) curvatureSignature.length = numSamples

  const fd = fourierDescriptors(curvatureSignature, numHarmonics)

  return { curvatureSignature, fourierDescriptors: fd }
}

/**
 * L2 distance between two Fourier descriptor vectors.
 */
export function morphologyDistance(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < len; i++) {
    const d = a[i]! - b[i]!
    sum += d * d
  }
  return Math.sqrt(sum)
}
