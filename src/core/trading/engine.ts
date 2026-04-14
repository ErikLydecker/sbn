import type { OpenPosition, ClosedTrade, TradeDirection } from '@/schemas/trade'
import type { RegimeId } from '@/schemas/regime'
import type { GpModel } from './gaussian-process'
import type { HmmAlpha } from '@/core/dsp/hmm'
import { createGp, gpAddObservation, restoreGp } from './gaussian-process'
import type { PersistedGpState, PersistedPortfolio } from '@/services/persistence/db'
import { ucbAcquire, decodeParams } from './ucb'
import { classifyRegime, regimeDirection } from './regimes'
import { shouldEnter, shouldExit, kappaConfidence, topologyConfidence, shapeConfidence } from './signals'
import { circDiff } from '@/core/math/circular'
import { TRADING_CONFIG } from '@/config/trading'

export interface PortfolioState {
  equity: number
  initialEquity: number
  position: OpenPosition | null
  trades: ClosedTrade[]
  equityCurve: number[]
  gps: GpModel[]
  cooldowns: number[]
  returns: number[]
  currentRegimeId: RegimeId | null
  barCount: number
  lastClockPos: number
  clockVel: number
  clockAccel: number
  flipBarCount: number
  kappaPersistence: number
  prevTopologyClass: string
}

export function createPortfolioState(): PortfolioState {
  return {
    equity: TRADING_CONFIG.initialEquity,
    initialEquity: TRADING_CONFIG.initialEquity,
    position: null,
    trades: [],
    equityCurve: [TRADING_CONFIG.initialEquity],
    gps: Array.from({ length: 8 }, () => createGp()),
    cooldowns: new Array(8).fill(0) as number[],
    returns: [],
    currentRegimeId: null,
    barCount: 0,
    lastClockPos: 0,
    clockVel: 0,
    clockAccel: 0,
    flipBarCount: 0,
    kappaPersistence: 0,
    prevTopologyClass: 'drift',
  }
}

export function restorePortfolioState(
  gpRows: PersistedGpState[],
  portfolio: PersistedPortfolio,
): PortfolioState {
  return {
    equity: portfolio.equity,
    initialEquity: portfolio.initialEquity,
    position: null,
    trades: portfolio.trades as ClosedTrade[],
    equityCurve: portfolio.equityCurve,
    gps: gpRows.map((r) => restoreGp(r.inputs, r.outputs, r.kernelInverse)),
    cooldowns: portfolio.cooldowns,
    returns: portfolio.returns,
    currentRegimeId: null,
    barCount: portfolio.barCount,
    lastClockPos: 0,
    clockVel: 0,
    clockAccel: 0,
    flipBarCount: 0,
    kappaPersistence: 0,
    prevTopologyClass: 'drift',
  }
}

export interface ClockSnapshot {
  alpha: HmmAlpha
  kappa: number
  rBar: number
  ppc: number
  hurst: number
  clockPos: number
  price: number
  tDom: number
  topologyScore: number
  topologyClass: string
  morphologySpecies: number
  curvatureConcentration: number
}

export function portfolioTick(
  state: PortfolioState,
  snapshot: ClockSnapshot,
): PortfolioState {
  const next = { ...state }
  next.barCount++
  next.cooldowns = next.cooldowns.map((c) => Math.max(0, c - 1))

  const prevVel = next.clockVel
  const vel = updateClockVel(next, snapshot.clockPos)
  next.clockVel = vel
  next.clockAccel = vel - prevVel

  next.kappaPersistence = snapshot.kappa >= TRADING_CONFIG.kappaFloor
    ? next.kappaPersistence + 1
    : 0

  const regimeId = classifyRegime(snapshot.alpha, snapshot.kappa)
  next.currentRegimeId = regimeId

  if (next.position) {
    const posDir = regimeDirection(next.position.regimeId)
    const curDir = regimeDirection(regimeId)
    if (curDir !== posDir) {
      next.flipBarCount++
    } else {
      next.flipBarCount = 0
    }

    const topoClass = snapshot.topologyClass as import('@/core/dsp/topology').TopologyClass | undefined
    const prevTopo = next.prevTopologyClass as import('@/core/dsp/topology').TopologyClass | undefined
    const exitReason = shouldExit(next.position, regimeId, snapshot.clockPos, snapshot.price, next.barCount, snapshot.tDom, next.flipBarCount, topoClass, prevTopo)
    if (exitReason) {
      closeTrade(next, exitReason, snapshot.price, snapshot.tDom)
      next.flipBarCount = 0
    }
  }

  if (!next.position) {
    const gp = next.gps[regimeId]!
    const xNorm = ucbAcquire(gp)
    const params = decodeParams(xNorm)
    const dir = regimeDirection(regimeId)

    if (shouldEnter(regimeId, vel, next.clockAccel, snapshot.kappa, params, next.cooldowns, snapshot.alpha, next.kappaPersistence, snapshot.topologyScore, snapshot.hurst, snapshot.curvatureConcentration)) {
      openTrade(next, regimeId, dir as TradeDirection, snapshot.price, snapshot.clockPos, xNorm, params, snapshot.kappa, snapshot.rBar, snapshot.topologyScore, snapshot.curvatureConcentration, snapshot.morphologySpecies)
    }
  }

  next.prevTopologyClass = snapshot.topologyClass

  const unrealised = next.position ? calcPnl(next.position, snapshot.price) : 0
  next.equityCurve = [...next.equityCurve, next.equity + unrealised]
  if (next.equityCurve.length > TRADING_CONFIG.maxEquityCurvePoints) {
    next.equityCurve = next.equityCurve.slice(1)
  }

  return next
}

function updateClockVel(state: PortfolioState, clockPos: number): number {
  const raw = circDiff(clockPos * Math.PI * 2, state.lastClockPos * Math.PI * 2) / (Math.PI * 2)
  const vel = state.clockVel * 0.85 + raw * 0.15
  state.lastClockPos = clockPos
  return vel
}

function calcPnl(pos: OpenPosition, price: number): number {
  const raw = ((price - pos.entryPrice) / pos.entryPrice) * pos.direction
  return raw * pos.sizeUsd
}

function openTrade(
  state: PortfolioState,
  regimeId: RegimeId,
  dir: TradeDirection,
  price: number,
  clockPos: number,
  xNorm: number[],
  params: number[],
  kappa: number,
  rBar: number,
  topoScore?: number,
  curvConc?: number,
  species?: number,
): void {
  const sizeFrac = params[1]!
  const stop = params[2]!
  const exitPhase = params[3]!

  const phase = Math.floor(regimeId / 2)
  const isTurning = phase === 1 || phase === 3
  const kappaScale = isTurning ? kappaConfidence(kappa) : 1
  const topoScale = topoScore !== undefined ? topologyConfidence(topoScore) : 1
  const shapeScale = (isTurning && curvConc !== undefined) ? shapeConfidence(curvConc) : 1
  const confScale = kappaScale * topoScale * shapeScale
  const sizeUsd = state.equity * sizeFrac * confScale

  state.position = {
    direction: dir,
    entryPrice: price,
    entryBar: state.barCount,
    entryClockPos: clockPos,
    sizeUsd,
    stop,
    exitPhase,
    regimeId,
    paramVector: xNorm,
    entryEquity: state.equity,
    entryKappa: kappa,
    entryRBar: rBar,
    entryMorphologySpecies: species,
  }
}

function computeReward(
  pnl: number,
  pos: OpenPosition,
  barsHeld: number,
  tDom: number,
  reason: 'stop' | 'regime_flip' | 'phase_target',
): number {
  const w = TRADING_CONFIG.rewardWeights
  const directedReturn = ((pos.entryPrice > 0 ? pnl / pos.sizeUsd : 0))

  const r = directedReturn * 100
  const rReturn = r >= 0 ? r : r * TRADING_CONFIG.lossPenaltyMultiplier

  const maxRisk = pos.sizeUsd * pos.stop
  const rRisk = pnl >= 0
    ? Math.min(maxRisk > 0 ? pnl / maxRisk : 0, 2.0)
    : -(maxRisk > 0 ? Math.abs(pnl) / maxRisk : 0) * 2.0

  const holdFraction = tDom > 0 ? barsHeld / tDom : 1
  const inSweetSpot = holdFraction >= 0.25 && holdFraction <= 1.5
  const rEfficiency = inSweetSpot ? r * 1.2 : r * 0.8

  const rAlignment = reason === 'phase_target' ? 0.5
    : reason === 'regime_flip' ? 0.0
    : -0.5

  return w.return * rReturn + w.risk * rRisk + w.efficiency * rEfficiency + w.alignment * rAlignment
}

function closeTrade(
  state: PortfolioState,
  reason: 'stop' | 'regime_flip' | 'phase_target',
  price: number,
  tDom: number,
): void {
  const pos = state.position
  if (!pos) return

  const pnl = calcPnl(pos, price)
  const retPct = (pnl / pos.entryEquity) * 100
  const barsHeld = state.barCount - pos.entryBar
  const reward = computeReward(pnl, pos, barsHeld, tDom, reason)

  state.equity += pnl
  state.equity = Math.max(state.equity, TRADING_CONFIG.minEquity)
  state.returns = [...state.returns, retPct]

  const trade: ClosedTrade = {
    regimeId: pos.regimeId,
    direction: pos.direction,
    pnl,
    returnPct: retPct,
    reward,
    bars: barsHeld,
    reason,
    exitPrice: price,
    timestamp: Date.now(),
    paramVector: pos.paramVector,
    entryKappa: pos.entryKappa,
    entryRBar: pos.entryRBar,
    entryMorphologySpecies: pos.entryMorphologySpecies,
  }

  state.trades = [...state.trades, trade]
  if (state.trades.length > TRADING_CONFIG.maxTradeHistory) {
    state.trades = state.trades.slice(1)
  }

  gpAddObservation(state.gps[pos.regimeId]!, pos.paramVector, reward)

  const params = decodeParams(pos.paramVector)
  state.cooldowns = [...state.cooldowns]
  state.cooldowns[pos.regimeId] = Math.round(params[4]!)
  state.position = null
}
