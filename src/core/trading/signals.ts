import type { OpenPosition } from '@/schemas/trade'
import type { RegimeId } from '@/schemas/regime'
import type { HmmAlpha } from '@/core/dsp/hmm'
import type { TopologyClass } from '@/core/dsp/topology'
import { regimeDirection } from './regimes'
import { decodeParams } from './ucb'
import { TRADING_CONFIG } from '@/config/trading'

const TURNING_PHASES = new Set([1, 3])
const TURNING_ENTRY_THR_MIN = 0.005

/**
 * Sigmoid confidence weight from kappa.
 * Returns 0..1 — used to scale position size at turning points.
 */
export function kappaConfidence(kappa: number): number {
  const { kappaSigmoidCenter: c, kappaSigmoidSteepness: s } = TRADING_CONFIG
  return 1 / (1 + Math.exp(-s * (kappa - c)))
}

export function topologyConfidence(topologyScore: number): number {
  const { topologySigmoidCenter: c, topologySigmoidSteepness: s } = TRADING_CONFIG
  return 1 / (1 + Math.exp(-s * (topologyScore - c)))
}

export function shouldEnter(
  regimeId: RegimeId,
  clockVel: number,
  clockAccel: number,
  kappa: number,
  params: number[],
  cooldowns: number[],
  alpha: HmmAlpha,
  kappaPersistence: number,
  topologyScore?: number,
  hurst?: number,
): boolean {
  if (cooldowns[regimeId]! > 0) return false
  const phase = Math.floor(regimeId / 2)
  const minConf = params[5]!
  if (alpha[phase]! < minConf) return false

  if (topologyScore !== undefined && topologyScore < TRADING_CONFIG.topologyFloor) return false

  const isTurning = TURNING_PHASES.has(phase)

  if (isTurning) {
    if (kappa < TRADING_CONFIG.kappaFloor) return false
    if (kappaPersistence < TRADING_CONFIG.kappaPersistenceBars) return false
    if (hurst !== undefined && hurst > TRADING_CONFIG.hurstTrendThreshold) return false
  }

  const dir = regimeDirection(regimeId)
  const entryThreshold = isTurning
    ? Math.max(params[0]!, TURNING_ENTRY_THR_MIN)
    : params[0]!
  if (Math.abs(clockVel) < entryThreshold) return false

  if (dir === 1) {
    if (clockVel <= 0) return false
    if (isTurning && clockAccel <= 0) return false
  } else {
    if (clockVel >= 0) return false
    if (isTurning && clockAccel >= 0) return false
  }

  return true
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
    const minHold = Math.max(TRADING_CONFIG.minHoldFloor, Math.round(tDom * TRADING_CONFIG.minHoldFraction))
    if (barsHeld >= minHold) return 'regime_flip'
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
