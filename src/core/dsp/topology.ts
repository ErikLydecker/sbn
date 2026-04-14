import { DSP_CONFIG } from '@/config/dsp'
import type { CurvatureStats } from './curvature'
import type { PersistenceFeatures } from './persistence'
import type { MorphologySignature } from './morphology'

export type TopologyClass = 'stable_loop' | 'unstable_loop' | 'drift' | 'chaotic'

export interface TopologyFingerprint {
  timestamp: number
  windingNumber: number
  absWinding: number
  circulation: number
  loopClosure: number
  corrDim: number
  recurrenceRate: number
  structureScore: number
  topologyClass: TopologyClass
  kappa: number
  // Differential geometry
  meanCurvature: number
  maxCurvature: number
  curvatureVariance: number
  curvatureSkewness: number
  curvatureConcentration: number
  meanTorsion: number
  torsionEnergy: number
  // Persistence
  h0Persistence: number
  h1Peak: number
  h1Persistence: number
  fragmentationRate: number
  // Morphology
  fourierDescriptors: number[]
  // Species classification
  morphologySpecies: number
}

export interface FingerprintMatch {
  fingerprint: TopologyFingerprint
  similarity: number
}

export interface SpeciesCentroid {
  center: number[]
  count: number
}

export interface TopologyState {
  windingHistory: number[]
  circulationHistory: number[]
  closureHistory: number[]
  fingerprintHistory: TopologyFingerprint[]
  speciesCentroids: SpeciesCentroid[]
}

export interface TopologyResult {
  windingNumber: number
  absWinding: number
  circulation: number
  loopClosure: number
  topologyStability: number
  topologyScore: number
  isLoop: boolean
  topologyClass: TopologyClass
  fingerprint: TopologyFingerprint
  matchedFingerprints: FingerprintMatch[]
  updatedState: TopologyState
  morphologySpecies: number
}

export function createInitialTopologyState(): TopologyState {
  return {
    windingHistory: [],
    circulationHistory: [],
    closureHistory: [],
    fingerprintHistory: [],
    speciesCentroids: [],
  }
}

/**
 * Winding number around the centroid of the 2D projection (first two PCA axes).
 * Counts how many times the trajectory wraps around the centroid.
 */
export function computeWindingNumber(pts: number[][]): number {
  const n = pts.length
  if (n < 3) return 0

  let cx = 0, cy = 0
  for (const p of pts) {
    cx += p[0]!
    cy += p[1]!
  }
  cx /= n
  cy /= n

  let totalAngle = 0
  for (let i = 1; i < n; i++) {
    const dx0 = pts[i - 1]![0]! - cx
    const dy0 = pts[i - 1]![1]! - cy
    const dx1 = pts[i]![0]! - cx
    const dy1 = pts[i]![1]! - cy
    totalAngle += Math.atan2(dx0 * dy1 - dy0 * dx1, dx0 * dx1 + dy0 * dy1)
  }

  return totalAngle / (2 * Math.PI)
}

/**
 * Circulation: sum of squared displacements normalized by point count.
 * Measures total kinetic energy along the trajectory path.
 */
export function computeCirculation(pts: number[][]): number {
  const n = pts.length
  if (n < 2) return 0

  let circ = 0
  for (let i = 1; i < n; i++) {
    const prev = pts[i - 1]!
    const cur = pts[i]!
    for (let d = 0; d < prev.length; d++) {
      const diff = cur[d]! - prev[d]!
      circ += diff * diff
    }
  }

  return circ / (n - 1)
}

/**
 * Loop closure: how well the trajectory returns to its starting point.
 * 1 = perfectly closed, 0 = fully open.
 */
export function computeLoopClosure(pts: number[][]): number {
  const n = pts.length
  if (n < 3) return 0

  const first = pts[0]!
  const last = pts[n - 1]!

  let closeDist = 0
  for (let d = 0; d < first.length; d++) {
    const diff = last[d]! - first[d]!
    closeDist += diff * diff
  }
  closeDist = Math.sqrt(closeDist)

  let maxDist = 0
  const sampleStep = Math.max(1, Math.floor(n / 50))
  for (let i = 0; i < n; i += sampleStep) {
    for (let j = i + sampleStep; j < n; j += sampleStep) {
      let d2 = 0
      for (let d = 0; d < pts[i]!.length; d++) {
        const diff = pts[j]![d]! - pts[i]![d]!
        d2 += diff * diff
      }
      if (d2 > maxDist) maxDist = d2
    }
  }
  maxDist = Math.sqrt(maxDist)

  if (maxDist < 1e-12) return 0
  return Math.max(0, Math.min(1, 1 - closeDist / maxDist))
}

/**
 * Topological stability from coefficient of variation of recent invariants.
 * Low CV = topology persists = high stability.
 */
export function computeTopologyStability(state: TopologyState): number {
  const { stabilityWindow } = DSP_CONFIG.topology

  const windSlice = state.windingHistory.slice(-stabilityWindow)
  const circSlice = state.circulationHistory.slice(-stabilityWindow)
  const closeSlice = state.closureHistory.slice(-stabilityWindow)

  if (windSlice.length < 3) return 0

  const windCV = coeffOfVariation(windSlice.map(Math.abs))
  const circCV = coeffOfVariation(circSlice)
  const closeCV = coeffOfVariation(closeSlice)

  const avgCV = (windCV + circCV + closeCV) / 3
  return Math.max(0, Math.min(1, 1 - avgCV))
}

function coeffOfVariation(arr: number[]): number {
  if (arr.length < 2) return 1
  let sum = 0
  for (const v of arr) sum += v
  const mean = sum / arr.length
  if (Math.abs(mean) < 1e-12) return 1

  let ssq = 0
  for (const v of arr) {
    const d = v - mean
    ssq += d * d
  }
  const std = Math.sqrt(ssq / arr.length)
  return Math.min(std / Math.abs(mean), 2) / 2
}

function classifyTopology(
  absWinding: number,
  stability: number,
  loopClosure: number,
): TopologyClass {
  const { windingLoopThreshold } = DSP_CONFIG.topology
  const isLoop = absWinding >= windingLoopThreshold

  if (isLoop && stability >= 0.5 && loopClosure >= 0.3) return 'stable_loop'
  if (isLoop) return 'unstable_loop'
  if (stability < 0.2 && absWinding > 0.3) return 'chaotic'
  return 'drift'
}

function computeTopologyScore(
  absWinding: number,
  circulation: number,
  loopClosure: number,
  stability: number,
): number {
  const windingComponent = Math.min(absWinding, 2) / 2
  const closureComponent = loopClosure
  const stabilityComponent = stability
  const circulationComponent = Math.min(circulation * 100, 1)

  const score = windingComponent * 0.35
    + closureComponent * 0.25
    + stabilityComponent * 0.25
    + circulationComponent * 0.15

  return Math.max(0, Math.min(1, score))
}

export function fingerprintToVector(fp: TopologyFingerprint): number[] {
  return [
    fp.absWinding,
    fp.circulation,
    fp.loopClosure,
    fp.corrDim,
    fp.recurrenceRate,
    fp.structureScore,
    fp.kappa,
    fp.meanCurvature,
    fp.maxCurvature,
    fp.curvatureVariance,
    fp.curvatureSkewness,
    fp.curvatureConcentration,
    fp.meanTorsion,
    fp.torsionEnergy,
    fp.h0Persistence,
    fp.h1Peak,
    fp.h1Persistence,
    fp.fragmentationRate,
    ...(fp.fourierDescriptors ?? []),
  ]
}

function normalizeVector(v: number[]): number[] {
  let mag = 0
  for (const x of v) mag += x * x
  mag = Math.sqrt(mag)
  if (mag < 1e-12) return v.map(() => 0)
  return v.map((x) => x / mag)
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    magA += a[i]! * a[i]!
    magB += b[i]! * b[i]!
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  if (denom < 1e-12) return 0
  return dot / denom
}

function findFingerprintMatches(
  current: TopologyFingerprint,
  history: TopologyFingerprint[],
): FingerprintMatch[] {
  const { fingerprintSimilarityThreshold } = DSP_CONFIG.topology
  const currentVec = normalizeVector(fingerprintToVector(current))
  const matches: FingerprintMatch[] = []

  for (const fp of history) {
    const histVec = normalizeVector(fingerprintToVector(fp))
    const sim = cosineSimilarity(currentVec, histVec)
    if (sim >= fingerprintSimilarityThreshold) {
      matches.push({ fingerprint: fp, similarity: sim })
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity)
  return matches.slice(0, 20)
}

export interface TopologyInput {
  pts: number[][]
  corrDim: number
  recurrenceRate: number
  structureScore: number
  kappa: number
  timestamp: number
  curvatureStats?: CurvatureStats
  persistenceFeatures?: PersistenceFeatures
  morphologySignature?: MorphologySignature
}

/**
 * Online k-means: assign a point to the nearest centroid, then update that centroid.
 * If fewer than K centroids exist, create a new one.
 */
function assignSpecies(
  vec: number[],
  centroids: SpeciesCentroid[],
  k: number,
): { species: number; centroids: SpeciesCentroid[] } {
  if (centroids.length < k) {
    const newCentroids = [...centroids, { center: [...vec], count: 1 }]
    return { species: newCentroids.length - 1, centroids: newCentroids }
  }

  let bestDist = Infinity
  let bestIdx = 0
  for (let i = 0; i < centroids.length; i++) {
    let d2 = 0
    const c = centroids[i]!.center
    for (let j = 0; j < vec.length && j < c.length; j++) {
      const diff = vec[j]! - c[j]!
      d2 += diff * diff
    }
    if (d2 < bestDist) {
      bestDist = d2
      bestIdx = i
    }
  }

  const updated = centroids.map((c, i) => {
    if (i !== bestIdx) return c
    const newCount = c.count + 1
    const alpha = 1 / newCount
    const newCenter = c.center.map((v, j) => v * (1 - alpha) + (vec[j] ?? 0) * alpha)
    return { center: newCenter, count: newCount }
  })

  return { species: bestIdx, centroids: updated }
}

/**
 * Main entry point: compute all topology invariants, update state, find matches.
 */
export function computeTopology(
  input: TopologyInput,
  state: TopologyState | null,
): TopologyResult {
  const s = state ?? createInitialTopologyState()
  const { maxFingerprintHistory, stabilityWindow } = DSP_CONFIG.topology
  const { speciesK } = DSP_CONFIG.morphology

  const windingNumber = computeWindingNumber(input.pts)
  const absWinding = Math.abs(windingNumber)
  const circulation = computeCirculation(input.pts)
  const loopClosure = computeLoopClosure(input.pts)

  const updatedState: TopologyState = {
    windingHistory: [...s.windingHistory, windingNumber].slice(-stabilityWindow),
    circulationHistory: [...s.circulationHistory, circulation].slice(-stabilityWindow),
    closureHistory: [...s.closureHistory, loopClosure].slice(-stabilityWindow),
    fingerprintHistory: s.fingerprintHistory,
    speciesCentroids: s.speciesCentroids,
  }

  const topologyStability = computeTopologyStability(updatedState)
  const topologyClass = classifyTopology(absWinding, topologyStability, loopClosure)
  const topologyScore = computeTopologyScore(absWinding, circulation, loopClosure, topologyStability)
  const isLoop = absWinding >= DSP_CONFIG.topology.windingLoopThreshold

  const cs = input.curvatureStats
  const pf = input.persistenceFeatures
  const ms = input.morphologySignature

  const fingerprint: TopologyFingerprint = {
    timestamp: input.timestamp,
    windingNumber,
    absWinding,
    circulation,
    loopClosure,
    corrDim: input.corrDim,
    recurrenceRate: input.recurrenceRate,
    structureScore: input.structureScore,
    topologyClass,
    kappa: input.kappa,
    meanCurvature: cs?.meanCurvature ?? 0,
    maxCurvature: cs?.maxCurvature ?? 0,
    curvatureVariance: cs?.curvatureVariance ?? 0,
    curvatureSkewness: cs?.curvatureSkewness ?? 0,
    curvatureConcentration: cs?.curvatureConcentration ?? 0,
    meanTorsion: cs?.meanTorsion ?? 0,
    torsionEnergy: cs?.torsionEnergy ?? 0,
    h0Persistence: pf?.h0Persistence ?? 0,
    h1Peak: pf?.h1Peak ?? 0,
    h1Persistence: pf?.h1Persistence ?? 0,
    fragmentationRate: pf?.fragmentationRate ?? 0,
    fourierDescriptors: ms?.fourierDescriptors ?? [],
    morphologySpecies: -1,
  }

  const vec = fingerprintToVector(fingerprint)
  const speciesResult = assignSpecies(vec, updatedState.speciesCentroids, speciesK)
  fingerprint.morphologySpecies = speciesResult.species
  updatedState.speciesCentroids = speciesResult.centroids

  const matchedFingerprints = findFingerprintMatches(fingerprint, updatedState.fingerprintHistory)

  updatedState.fingerprintHistory = [...updatedState.fingerprintHistory, fingerprint].slice(-maxFingerprintHistory)

  return {
    windingNumber,
    absWinding,
    circulation,
    loopClosure,
    topologyStability,
    topologyScore,
    isLoop,
    topologyClass,
    fingerprint,
    matchedFingerprints,
    updatedState,
    morphologySpecies: fingerprint.morphologySpecies,
  }
}
