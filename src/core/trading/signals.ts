import type { OpenPosition } from '@/schemas/trade'
import type { RegimeId } from '@/schemas/regime'
import type { HmmAlpha } from '@/core/dsp/hmm'
import type { TopologyClass } from '@/core/dsp/topology'
import type { ClockSnapshot } from './engine'
import { regimeDirection } from './regimes'
import { decodeParams } from './ucb'
import { TRADING_CONFIG } from '@/config/trading'

const TURNING_PHASES = new Set([1, 3])
const TRENDING_PHASES = new Set([0, 2])

function sigmoid(value: number, center: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * (value - center)))
}

function hmmEntropy(alpha: HmmAlpha): number {
  let h = 0
  for (const a of alpha) {
    if (a > 1e-12) h -= a * Math.log2(a)
  }
  return h / 2 // normalize to 0-1 (max entropy for 4 states = 2 bits)
}

export interface CrsBreakdown {
  coherence: number
  regime: number
  topology: number
  geometry: number
  trend: number
  composite: number
}

export function computeCrs(
  snapshot: ClockSnapshot,
  clockVel: number,
  kappaPersistence: number,
  phase: number,
): CrsBreakdown {
  const cfg = TRADING_CONFIG.crs
  const s = cfg.sigmoids

  // --- Phase Coherence group ---
  const kappaR = sigmoid(snapshot.kappa, s.kappa.center, s.kappa.steepness)
  const ppcR = sigmoid(snapshot.ppc, s.ppc.center, s.ppc.steepness)
  const kappaPersR = sigmoid(kappaPersistence, s.kappaPersistence.center, s.kappaPersistence.steepness)
  const coherenceGroup = (kappaR + ppcR + kappaPersR) / 3

  // --- Regime Confidence group ---
  const alphaR = sigmoid(snapshot.alpha[phase]!, s.alpha.center, s.alpha.steepness)
  const entropyVal = hmmEntropy(snapshot.alpha)
  const entropyR = sigmoid(entropyVal, s.hmmEntropy.center, s.hmmEntropy.steepness)
  const regimeGroup = (alphaR + entropyR) / 2

  // --- Topology group ---
  const topoR = sigmoid(snapshot.topologyScore, s.topologyScore.center, s.topologyScore.steepness)
  const recurrR = sigmoid(snapshot.recurrenceRate, s.recurrenceRate.center, s.recurrenceRate.steepness)
  const structR = sigmoid(snapshot.structureScore, s.structureScore.center, s.structureScore.steepness)
  const topoGroup = (topoR + recurrR + structR) / 3

  // --- Geometry group ---
  const curvR = sigmoid(snapshot.curvatureConcentration, s.curvatureConc.center, s.curvatureConc.steepness)
  const h1R = sigmoid(snapshot.h1Peak, s.h1Peak.center, s.h1Peak.steepness)
  const torsionR = sigmoid(snapshot.torsionEnergy, s.torsionEnergy.center, s.torsionEnergy.steepness)
  const stabR = sigmoid(snapshot.subspaceStability, s.subspaceStability.center, s.subspaceStability.steepness)
  const geomGroup = (curvR + h1R + torsionR + stabR) / 4

  // --- Trend group (Hurst-adaptive) ---
  const hurst = snapshot.hurst
  const isTurning = TURNING_PHASES.has(phase)
  const isTrending = TRENDING_PHASES.has(phase)
  let hurstR: number
  if (isTrending) {
    // High Hurst boosts trend trades
    hurstR = hurst > cfg.hurstTrendFloor
      ? Math.min(1, sigmoid(hurst, cfg.hurstTrendFloor, 8) * cfg.hurstBoost)
      : sigmoid(hurst, 0.5, 4)
  } else if (isTurning) {
    // Low Hurst boosts turning-phase (mean-reversion) trades
    hurstR = hurst < cfg.hurstCyclicCeiling
      ? Math.min(1, sigmoid(1 - hurst, 1 - cfg.hurstCyclicCeiling, 8) * cfg.hurstBoost)
      : cfg.hurstPenalty
  } else {
    hurstR = 0.5
  }
  const velR = sigmoid(Math.abs(clockVel), s.clockVel.center, s.clockVel.steepness)
  const trendGroup = (hurstR + velR) / 2

  // --- Composite: weighted geometric mean ---
  const w = cfg.groupWeights
  const eps = 1e-6
  const composite = Math.pow(Math.max(coherenceGroup, eps), w.coherence)
    * Math.pow(Math.max(regimeGroup, eps), w.regime)
    * Math.pow(Math.max(topoGroup, eps), w.topology)
    * Math.pow(Math.max(geomGroup, eps), w.geometry)
    * Math.pow(Math.max(trendGroup, eps), w.trend)

  return {
    coherence: coherenceGroup,
    regime: regimeGroup,
    topology: topoGroup,
    geometry: geomGroup,
    trend: trendGroup,
    composite,
  }
}

export function shouldEnter(
  regimeId: RegimeId,
  clockVel: number,
  clockAccel: number,
  snapshot: ClockSnapshot,
  params: number[],
  cooldowns: number[],
  kappaPersistence: number,
): { enter: boolean; crs: number } {
  if (cooldowns[regimeId]! > 0) return { enter: false, crs: 0 }

  const phase = Math.floor(regimeId / 2)
  const dir = regimeDirection(regimeId)

  // Direction match is still binary -- not a confidence question
  if (dir === 1 && clockVel <= 0) return { enter: false, crs: 0 }
  if (dir === -1 && clockVel >= 0) return { enter: false, crs: 0 }

  // At turning phases, require acceleration to confirm the reversal
  const isTurning = TURNING_PHASES.has(phase)
  if (isTurning) {
    if (dir === 1 && clockAccel <= 0) return { enter: false, crs: 0 }
    if (dir === -1 && clockAccel >= 0) return { enter: false, crs: 0 }
  }

  const breakdown = computeCrs(snapshot, clockVel, kappaPersistence, phase)
  const threshold = params[5]! * TRADING_CONFIG.crs.threshold / 0.5
  const effectiveThreshold = Math.max(TRADING_CONFIG.crs.threshold * 0.5, Math.min(threshold, 0.8))

  return {
    enter: breakdown.composite >= effectiveThreshold,
    crs: breakdown.composite,
  }
}

export type ExitReason = 'stop' | 'regime_flip' | 'phase_target'

export function shouldExit(
  pos: OpenPosition,
  currentRegime: RegimeId,
  clockPos: number,
  currentPrice: number,
  currentBar: number,
  tDom: number,
  flipBarCount: number,
  topologyClass?: TopologyClass,
  prevTopologyClass?: TopologyClass,
): ExitReason | false {
  const barsHeld = currentBar - pos.entryBar

  const priceDelta = (currentPrice - pos.entryPrice) / pos.entryPrice
  const directedReturn = priceDelta * pos.direction

  const params = decodeParams(pos.paramVector)
  const stop = params[2]!
  if (directedReturn < -stop) return 'stop'

  const minHold = Math.max(TRADING_CONFIG.minHoldFloor, Math.round(tDom * TRADING_CONFIG.minHoldFraction))
  if (barsHeld < minHold) return false

  const posDir = regimeDirection(pos.regimeId)
  const curDir = regimeDirection(currentRegime)
  if (curDir !== posDir) {
    const flipConfirm = Math.max(2, Math.round(tDom * 0.1))
    if (flipBarCount >= flipConfirm) return 'regime_flip'
    return false
  }

  if (
    TRADING_CONFIG.topologyCollapseExit &&
    topologyClass && prevTopologyClass &&
    (prevTopologyClass === 'stable_loop' || prevTopologyClass === 'unstable_loop') &&
    (topologyClass === 'drift' || topologyClass === 'chaotic')
  ) {
    const topoMinHold = Math.max(TRADING_CONFIG.minHoldFloor, Math.round(tDom * TRADING_CONFIG.minHoldFraction))
    if (barsHeld >= topoMinHold) return 'regime_flip'
  }

  const exitPh = params[3]!
  const advance = ((clockPos - pos.entryClockPos) + 1) % 1
  if (advance < TRADING_CONFIG.minPhaseAdvance) return false
  const returnPct = directedReturn * 100
  if (returnPct < TRADING_CONFIG.minReturnPctForPhaseExit) return false

  const entryPhase = Math.floor(pos.regimeId / 2)
  const targetExitPhase = (entryPhase + 1) % 4
  const normalPos = ((clockPos - targetExitPhase / 4) + 1) % 1
  if (normalPos < exitPh) return 'phase_target'

  return false
}
