import { detrend } from './detrend'
import { normalize } from './normalize'
import { dft } from './dft'
import { coherence } from './coherence'
import { estimateTdom } from './t-dom'
import { estimateTau } from './tau'
import { estimateDim } from './embedding'
import { takensEmbed } from './takens'
import { takensPhase } from './phase'
import { pcaProject3 } from './pca3'
import { computeRecurrence } from './recurrence'
import { vmFilter } from './von-mises'
import { buildHmmTransition, hmmForward, hmmToClockPos } from './hmm'
import type { HmmAlpha } from './hmm'
import { GoertzelBank } from './goertzel'
import { causalDenoise } from './denoise'
import { circDiff } from '@/core/math/circular'
import { DSP_CONFIG } from '@/config/dsp'
import { TRADING_CONFIG } from '@/config/trading'
import type { RawAnalysis, SmoothAnalysis } from '@/schemas/analysis'
import type { RegimeId } from '@/schemas/regime'

export interface PhaseKappaEntry {
  phase: number
  kappa: number
  regimeId: number
}

export interface SmoothClockState {
  vmMu: number
  vmKappa: number
  alpha: HmmAlpha
  clockPos: number
  vel: number
  trail: number[]
  tau: number
  dim: number
  tDom: number
  hmmA: number[][] | null
  hmmTdomA: number
  lastTdom: number
  goertzelBank: GoertzelBank | null
  barsSinceSanity: number
  consecutiveSoftCorrections: number
  phaseKappaHistory: PhaseKappaEntry[]
  lastRegimeId: number
}

export function createInitialSmoothState(): SmoothClockState {
  return {
    vmMu: 0,
    vmKappa: 1,
    alpha: [0.25, 0.25, 0.25, 0.25],
    clockPos: 0,
    vel: 0,
    trail: [],
    tau: 4,
    dim: 5,
    tDom: DSP_CONFIG.tDom.fallback,
    hmmA: null,
    hmmTdomA: 0,
    lastTdom: 0,
    goertzelBank: null,
    barsSinceSanity: 0,
    consecutiveSoftCorrections: 0,
    phaseKappaHistory: [],
    lastRegimeId: -1,
  }
}

const MAX_GEOMETRY_HISTORY = 3000

function classifyRegimeInline(alpha: HmmAlpha, kappa: number): RegimeId {
  const phase = alpha.indexOf(Math.max(...alpha))
  const highK = kappa >= TRADING_CONFIG.kappaThreshold
  return (phase * 2 + (highK ? 0 : 1)) as RegimeId
}

export function computeTransitionMatrix(history: PhaseKappaEntry[]): number[] {
  const m = new Array(64).fill(0) as number[]
  for (let i = 1; i < history.length; i++) {
    const from = history[i - 1]!.regimeId
    const to = history[i]!.regimeId
    m[from * 8 + to]!++
  }
  return m
}

export function analyseRaw(
  prices: number[],
  windowSize: number,
  manualK: number | null,
): RawAnalysis | null {
  if (prices.length < 32) return null

  const rawWin = prices.slice(-windowSize)
  const returns = logReturns(rawWin)
  if (returns.length < 16) return null
  const nor = normalize(detrend(returns))
  if (nor.every((v) => v === 0)) return null

  const tapered = hann(nor)
  const freqs = dft(tapered)
  if (freqs.length === 0) return null

  const sorted = freqs.slice().sort((a, b) => b.amp - a.amp)
  const domK = manualK ?? sorted[0]!.k

  const { rBar, meanPhase } = coherence(nor, domK)

  const t = nor.length - 1
  const aR = (2 * Math.PI * domK * t) / nor.length
  const cpR = Math.atan2(-nor[t]! * Math.sin(aR), nor[t]! * Math.cos(aR))
  const phDeg = ((cpR * 180) / Math.PI + 360) % 360
  const cycPos = (t % (nor.length / domK)) / (nor.length / domK)

  return {
    phaseDeg: phDeg,
    rBar,
    cyclePosition: cycPos,
    dominantK: domK,
    frequencies: freqs,
    windowData: rawWin,
    meanPhase,
  }
}

export function analyseSmooth(
  eventBars: number[],
  state: SmoothClockState,
): { result: SmoothAnalysis; state: SmoothClockState } | null {
  const minBars = DSP_CONFIG.minBootstrapBars
  if (eventBars.length < minBars) {
    const pct = eventBars.length / minBars
    return {
      result: createBootstrappingResult(eventBars.length, pct),
      state,
    }
  }

  const gCfg = DSP_CONFIG.goertzel
  const dCfg = DSP_CONFIG.denoise
  const cleanBars = dCfg.enabled
    ? causalDenoise(eventBars, dCfg.levels, dCfg.thresholdMultiplier, dCfg.thresholdLevels)
    : eventBars

  const tDom = estimateTdomCausal(eventBars, cleanBars, state, gCfg)

  const tauMax = Math.max(1, Math.floor(tDom / 4))
  const tauFloor = Math.max(DSP_CONFIG.tau.minTau, Math.floor(tDom / 8))
  const tauSig = normalize(detrend(cleanBars.slice(-Math.min(cleanBars.length, Math.round(2.5 * tDom)))))
  const tau = Math.max(tauFloor, estimateTau(tauSig, tauMax))
  const dim = estimateDim(tauSig, tau, 6)
  const mFromSpan = Math.round(tDom / Math.max(tau, 1)) + 1
  const m = Math.min(Math.max(mFromSpan, 3), dim, 6)

  const geomWin = Math.max((m - 1) * tau + 20, Math.round(tDom))
  const geomSig = normalize(detrend(cleanBars.slice(-Math.min(cleanBars.length, geomWin))))
  const vecs = takensEmbed(geomSig, m, tau)
  if (vecs.length < 8) return null

  const phaseWin = Math.round(2.5 * tDom)
  const phaseSig = normalize(detrend(cleanBars.slice(-Math.min(cleanBars.length, phaseWin))))
  const phaseVecs = takensEmbed(phaseSig, m, tau)
  if (phaseVecs.length < 8) return null
  const phases = takensPhase(phaseVecs)
  if (phases.length < 4) return null

  const vmHorizon = Math.max(2, Math.round(DSP_CONFIG.vonMises.horizonFraction * tDom))
  const lambda = 1 / vmHorizon
  const { mu, kappa, rBar } = vmFilter(phases, lambda)

  const maxVizPts = 500
  const vizSmoothLen = Math.max(3, Math.round(tDom / 8))
  const vizTau = Math.max(tau, Math.round(tDom / 6))
  const vizSpan = (m - 1) * vizTau
  const vizWin = Math.min(cleanBars.length, maxVizPts + vizSpan + vizSmoothLen + 20)
  const vizRaw = normalize(detrend(cleanBars.slice(-vizWin)))
  const vizSmoothed = smoothMA(vizRaw, vizSmoothLen)
  const vizVecs = takensEmbed(vizSmoothed, m, vizTau)
  const vizSlice = vizVecs.length > maxVizPts ? vizVecs.slice(vizVecs.length - maxVizPts) : vizVecs
  const projected = pcaProject3(vizSlice)
  const recResult = projected.length >= 10
    ? computeRecurrence(projected, 0.1)
    : null

  const newState = { ...state }
  newState.vmMu = mu
  newState.vmKappa = kappa
  newState.tDom = tDom
  newState.lastTdom = tDom
  newState.tau = tau
  newState.dim = m

  const rebuildPct = DSP_CONFIG.tDom.hmmRebuildPct
  const tDomDrift = newState.hmmTdomA > 0
    ? Math.abs(tDom - newState.hmmTdomA) / newState.hmmTdomA
    : 1
  if (!newState.hmmA || tDomDrift > rebuildPct) {
    newState.hmmA = buildHmmTransition(tDom)
    newState.hmmTdomA = tDom
  }

  newState.alpha = hmmForward(newState.alpha, newState.hmmA, mu, kappa)

  const regimeId = classifyRegimeInline(newState.alpha, kappa)
  newState.phaseKappaHistory = [...newState.phaseKappaHistory, { phase: mu, kappa, regimeId }]
  if (newState.phaseKappaHistory.length > MAX_GEOMETRY_HISTORY) {
    newState.phaseKappaHistory = newState.phaseKappaHistory.slice(-MAX_GEOMETRY_HISTORY)
  }
  newState.lastRegimeId = regimeId

  const targetPos = hmmToClockPos(newState.alpha)
  const spring = 0.5 / Math.max(tDom, 8)
  const diff = circDiff(targetPos * Math.PI * 2, newState.clockPos * Math.PI * 2) / (Math.PI * 2)
  newState.vel = newState.vel * DSP_CONFIG.smoothClock.dampingFactor + diff * spring * tDom * 0.6
  newState.vel = Math.max(-DSP_CONFIG.smoothClock.maxVelocity, Math.min(DSP_CONFIG.smoothClock.maxVelocity, newState.vel))
  newState.clockPos = ((newState.clockPos + newState.vel) + 1) % 1

  newState.trail = [...newState.trail, newState.clockPos]
  const trailLen = Math.round(tDom * DSP_CONFIG.smoothClock.trailLengthMultiplier)
  while (newState.trail.length > trailLen) newState.trail.shift()

  const phDeg = ((mu * 180) / Math.PI + 360) % 360
  const maxState = newState.alpha.indexOf(Math.max(...newState.alpha))
  const hmmDwell = Math.round(tDom / 4)
  const hmmPSelf = newState.hmmA[0]![0]!

  return {
    result: {
      phaseDeg: phDeg,
      rBar,
      vmKappa: kappa,
      vmMu: mu,
      clockPosition: newState.clockPos,
      clockVelocity: newState.vel,
      trail: newState.trail.slice(),
      hmmAlpha: [...newState.alpha],
      hmmActiveState: maxState,
      tDom,
      tDomFrac: newState.goertzelBank
        ? DSP_CONFIG.goertzel.refLength / newState.goertzelBank.peakK().kFrac
        : undefined,
      goertzelSpectrum: newState.goertzelBank
        ? newState.goertzelBank.spectrum()
        : undefined,
      goertzelDomK: newState.goertzelBank
        ? newState.goertzelBank.peakK().k
        : undefined,
      goertzelConfidence: newState.goertzelBank
        ? newState.goertzelBank.peakK().confidence
        : undefined,
      tau,
      embeddingDim: m,
      embedSpan: (m - 1) * tau,
      phaseWindow: phaseWin,
      vmHorizon,
      vmLambda: lambda,
      hmmDwell,
      hmmPSelf,
      barCount: eventBars.length,
      isBootstrapping: false,
      bootstrapProgress: 1,

      embeddingVecs: projected.length > 0 ? projected : undefined,
      recurrenceMatrix: recResult ? Array.from(recResult.matrix) : undefined,
      recurrenceSize: recResult?.size,
      recurrenceRate: recResult?.recurrenceRate,
      corrDimEstimate: recResult?.corrDimEstimate,
      structureScore: projected.length >= 10 ? computeStructureScore(projected) : undefined,
      pipelineReturns: eventBars.slice(-256),
      pipelineDenoised: cleanBars.slice(-256),
    },
    state: newState,
  }
}

function hann(sig: number[]): number[] {
  const n = sig.length
  return sig.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))))
}

function logReturns(prices: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1]!
    if (prev <= 0) { out.push(0); continue }
    out.push(Math.log(prices[i]! / prev))
  }
  return out
}

function estimateTdomCausal(
  _rawBars: number[],
  cleanBars: number[],
  state: SmoothClockState,
  gCfg: typeof DSP_CONFIG.goertzel,
): number {
  if (!gCfg.useGoertzel) {
    const lookback0 = Math.min(cleanBars.length, DSP_CONFIG.tDom.maxLookback)
    const sig0 = normalize(detrend(cleanBars.slice(-lookback0)))
    const rawTdom = estimateTdom(sig0)
    const alpha = DSP_CONFIG.tDom.emaAlpha
    return state.lastTdom > 0
      ? Math.round(state.lastTdom * (1 - alpha) + rawTdom * alpha)
      : rawTdom
  }

  const {
    lambda, refLength, subBinInterp, sanityIntervalMultiplier,
    persistenceDecay, persistenceThreshold, persistenceWeight,
    harmonicThreshold,
    softCorrectionThreshold, partialDecayThreshold, hardReseedThreshold,
    softBlendAlpha, partialDecayFactor, maxConsecutiveSoftCorrections,
  } = gCfg
  const maxK = DSP_CONFIG.raw.maxDftK
  const warmupLen = Math.ceil(1 / (1 - lambda))

  if (!state.goertzelBank) {
    state.goertzelBank = new GoertzelBank(maxK, refLength, lambda, subBinInterp, {
      persistenceDecay, persistenceThreshold, persistenceWeight, harmonicThreshold,
    })
    const seedLen = Math.min(cleanBars.length, warmupLen)
    state.goertzelBank.reseed(cleanBars.slice(-seedLen))
    state.barsSinceSanity = 0
  } else {
    state.goertzelBank.push(cleanBars[cleanBars.length - 1]!)
  }

  state.barsSinceSanity++

  if (state.goertzelBank.sampleCount < warmupLen) {
    const lookback0 = Math.min(cleanBars.length, DSP_CONFIG.tDom.maxLookback)
    const sig0 = normalize(detrend(cleanBars.slice(-lookback0)))
    return estimateTdom(sig0)
  }

  const peak = state.goertzelBank.peakK()
  let goertzelPeriod = Math.round(refLength / peak.kFrac)
  goertzelPeriod = Math.max(DSP_CONFIG.tDom.minPeriod, Math.min(DSP_CONFIG.tDom.maxPeriod, goertzelPeriod))

  const sanityInterval = Math.max(1, Math.round(goertzelPeriod * sanityIntervalMultiplier))
  if (state.barsSinceSanity >= sanityInterval) {
    state.barsSinceSanity = 0
    const lookback0 = Math.min(cleanBars.length, DSP_CONFIG.tDom.maxLookback)
    const sig0 = normalize(detrend(cleanBars.slice(-lookback0)))
    const dftPeriod = estimateTdom(sig0)
    const divergence = Math.abs(dftPeriod - goertzelPeriod) / dftPeriod

    const clampDft = Math.max(DSP_CONFIG.tDom.minPeriod, Math.min(DSP_CONFIG.tDom.maxPeriod, dftPeriod))

    if (divergence > hardReseedThreshold) {
      const seedLen = Math.min(cleanBars.length, warmupLen)
      state.goertzelBank.reseed(cleanBars.slice(-seedLen))
      state.barsSinceSanity = 0
      state.consecutiveSoftCorrections = 0
      return clampDft
    }

    if (
      divergence > partialDecayThreshold ||
      state.consecutiveSoftCorrections >= maxConsecutiveSoftCorrections
    ) {
      state.goertzelBank.partialDecay(partialDecayFactor)
      state.consecutiveSoftCorrections = 0
      return clampDft
    }

    if (divergence > softCorrectionThreshold) {
      state.consecutiveSoftCorrections++
      return Math.round(goertzelPeriod * (1 - softBlendAlpha) + dftPeriod * softBlendAlpha)
    }

    state.consecutiveSoftCorrections = 0
  }

  return goertzelPeriod
}

function createBootstrappingResult(barCount: number, progress: number): SmoothAnalysis {
  return {
    phaseDeg: 0,
    rBar: 0,
    vmKappa: 0,
    vmMu: 0,
    clockPosition: 0,
    clockVelocity: 0,
    trail: [],
    hmmAlpha: [0.25, 0.25, 0.25, 0.25],
    hmmActiveState: 0,
    tDom: DSP_CONFIG.tDom.fallback,
    tau: 1,
    embeddingDim: 5,
    embedSpan: 0,
    phaseWindow: 0,
    vmHorizon: 0,
    vmLambda: 0,
    hmmDwell: 0,
    hmmPSelf: 0,
    barCount,
    isBootstrapping: true,
    bootstrapProgress: progress,
  }
}

/**
 * Lightweight structure score from 3D-projected embedding points.
 * Measures axis symmetry of the attractor cloud: 1 = perfectly symmetric,
 * 0 = completely asymmetric. Equivalent to the voxel panel's symmetry metric
 * but computed directly from point coordinates without a voxel grid.
 */
function computeStructureScore(pts: number[][]): number {
  const n = pts.length
  if (n < 4) return 0

  let cx = 0, cy = 0, cz = 0
  for (const p of pts) {
    cx += p[0]!
    cy += p[1]!
    cz += p[2]!
  }
  cx /= n; cy /= n; cz /= n

  let pos0 = 0, pos1 = 0, pos2 = 0
  let neg0 = 0, neg1 = 0, neg2 = 0
  for (const p of pts) {
    p[0]! - cx >= 0 ? pos0++ : neg0++
    p[1]! - cy >= 0 ? pos1++ : neg1++
    p[2]! - cz >= 0 ? pos2++ : neg2++
  }

  let asymSum = 0
  const totals = [pos0 + neg0, pos1 + neg1, pos2 + neg2]
  const diffs = [Math.abs(pos0 - neg0), Math.abs(pos1 - neg1), Math.abs(pos2 - neg2)]
  for (let a = 0; a < 3; a++) {
    asymSum += totals[a]! > 0 ? diffs[a]! / totals[a]! : 0
  }

  return Math.max(0, Math.min(1, 1 - asymSum / 3))
}

function smoothMA(sig: number[], len: number): number[] {
  if (len <= 1) return sig
  const n = sig.length
  const out = new Array(n) as number[]
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += sig[i]!
    if (i >= len) sum -= sig[i - len]!
    const w = Math.min(i + 1, len)
    out[i] = sum / w
  }
  return out
}
