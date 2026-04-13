import { DSP_CONFIG } from '@/config/dsp'

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
}

export interface FingerprintMatch {
  fingerprint: TopologyFingerprint
  similarity: number
}

export interface TopologyState {
  windingHistory: number[]
  circulationHistory: number[]
  closureHistory: number[]
  fingerprintHistory: TopologyFingerprint[]
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
}

export function createInitialTopologyState(): TopologyState {
  return {
    windingHistory: [],
    circulationHistory: [],
    closureHistory: [],
    fingerprintHistory: [],
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

  const windingNumber = computeWindingNumber(input.pts)
  const absWinding = Math.abs(windingNumber)
  const circulation = computeCirculation(input.pts)
  const loopClosure = computeLoopClosure(input.pts)

  const updatedState: TopologyState = {
    windingHistory: [...s.windingHistory, windingNumber].slice(-stabilityWindow),
    circulationHistory: [...s.circulationHistory, circulation].slice(-stabilityWindow),
    closureHistory: [...s.closureHistory, loopClosure].slice(-stabilityWindow),
    fingerprintHistory: s.fingerprintHistory,
  }

  const topologyStability = computeTopologyStability(updatedState)
  const topologyClass = classifyTopology(absWinding, topologyStability, loopClosure)
  const topologyScore = computeTopologyScore(absWinding, circulation, loopClosure, topologyStability)
  const isLoop = absWinding >= DSP_CONFIG.topology.windingLoopThreshold

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
  }

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
  }
}
