import { EventClockResampler } from '@/services/event-clock/resampler'
import { OhlcAggregator } from '@/services/ohlc/aggregator'
import { analyseRaw, analyseSmooth, createInitialSmoothState, computeTransitionMatrix } from '@/core/dsp/pipeline'
import type { SmoothClockState } from '@/core/dsp/pipeline'
import { portfolioTick, createPortfolioState, restorePortfolioState } from '@/core/trading/engine'
import type { PortfolioState, ClockSnapshot } from '@/core/trading/engine'
import { computeCrs } from '@/core/trading/signals'
import { regimeDirection } from '@/core/trading/regimes'
import { TRADING_CONFIG } from '@/config/trading'
import type { WorkerInbound, WorkerOutbound } from './dsp.messages'
import { DSP_CONFIG } from '@/config/dsp'
import { GoertzelBank } from '@/core/dsp/goertzel'
import { saveGpStates, savePortfolio, saveSmoothState, loadGpStates, loadPortfolio, loadSmoothState, clearPersistedState, PERSISTENCE_VERSION } from '@/services/persistence/db'

const resampler = new EventClockResampler()
let ohlc = new OhlcAggregator('1m')
let smoothState: SmoothClockState = createInitialSmoothState()
let portfolioState: PortfolioState = createPortfolioState()
let rawWindow: number = DSP_CONFIG.raw.defaultWindow
let manualK: number | null = null
let lastAnalysisTime = 0
let lastPersistTime = 0
const PERSIST_INTERVAL_MS = 5_000

function post(msg: WorkerOutbound) {
  self.postMessage(msg)
}

function persistState() {
  const now = performance.now()
  if (now - lastPersistTime < PERSIST_INTERVAL_MS) return
  lastPersistTime = now

  saveGpStates(portfolioState.gps).catch(() => {})
  savePortfolio({
    equity: portfolioState.equity,
    initialEquity: portfolioState.initialEquity,
    trades: portfolioState.trades,
    equityCurve: portfolioState.equityCurve,
    cooldowns: portfolioState.cooldowns,
    returns: portfolioState.returns,
    barCount: portfolioState.barCount,
  }).catch(() => {})
  saveSmoothState({
    vmMu: smoothState.vmMu,
    vmKappa: smoothState.vmKappa,
    alpha: [...smoothState.alpha],
    clockPos: smoothState.clockPos,
    vel: smoothState.vel,
    trail: smoothState.trail.slice(),
    tau: smoothState.tau,
    dim: smoothState.dim,
    tDom: smoothState.tDom,
    hmmA: smoothState.hmmA,
    hmmTdomA: smoothState.hmmTdomA,
    lastTdom: smoothState.lastTdom,
    phaseKappaHistory: smoothState.phaseKappaHistory.slice(),
    lastRegimeId: smoothState.lastRegimeId,
    tDomEma: smoothState.tDomEma,
    tDomAccepted: smoothState.tDomAccepted,
    tDomCandidate: smoothState.tDomCandidate,
    tDomDwellCount: smoothState.tDomDwellCount,
    frozenTau: smoothState.frozenTau,
    frozenDim: smoothState.frozenDim,
    eventBars: resampler.getBars().slice(),
    eventTimestamps: resampler.getTimestamps().slice(),
    lastClosePrice: resampler.getLastPrice(),
    phaseBasisE1: smoothState.phaseBasis?.e1.slice(),
    phaseBasisE2: smoothState.phaseBasis?.e2.slice(),
    goertzelSnapshot: smoothState.goertzelBank?.serialize() ?? null,
    topologyState: smoothState.topologyState ?? null,
  }).catch(() => {})
}

async function restorePersistedState() {
  try {
    const [gpRows, portfolio, savedSmooth] = await Promise.all([loadGpStates(), loadPortfolio(), loadSmoothState()])
    if (gpRows && portfolio) {
      if (portfolio.version !== PERSISTENCE_VERSION) {
        await clearPersistedState()
        return
      }
      portfolioState = restorePortfolioState(gpRows, portfolio)
      post({
        type: 'portfolio',
        data: {
          equity: portfolioState.equity,
          position: portfolioState.position,
          trades: portfolioState.trades,
          equityCurve: portfolioState.equityCurve,
          currentRegimeId: portfolioState.currentRegimeId,
          reentryCooldowns: portfolioState.cooldowns,
          returns: portfolioState.returns,
          barCount: portfolioState.barCount,
          gpStates: portfolioState.gps.map((gp) => ({
            inputs: gp.X,
            outputs: gp.y,
            kernelInverse: gp.Kinv,
          })),
        },
      })
    }
    if (savedSmooth) {
      const fallback = DSP_CONFIG.tDom.fallback
      smoothState = {
        vmMu: savedSmooth.vmMu,
        vmKappa: savedSmooth.vmKappa,
        alpha: [...savedSmooth.alpha],
        clockPos: savedSmooth.clockPos,
        vel: savedSmooth.vel,
        trail: savedSmooth.trail.slice(),
        tau: savedSmooth.tau,
        dim: savedSmooth.dim,
        tDom: savedSmooth.tDom,
        hmmA: savedSmooth.hmmA,
        hmmTdomA: savedSmooth.hmmTdomA,
        lastTdom: savedSmooth.lastTdom,
        goertzelBank: null,
        barsSinceSanity: 0,
        consecutiveSoftCorrections: 0,
        phaseKappaHistory: savedSmooth.phaseKappaHistory?.slice() ?? [],
        lastRegimeId: savedSmooth.lastRegimeId ?? -1,
        tDomEma: savedSmooth.tDomEma ?? savedSmooth.tDom ?? fallback,
        tDomAccepted: savedSmooth.tDomAccepted ?? savedSmooth.tDom ?? fallback,
        tDomCandidate: savedSmooth.tDomCandidate ?? savedSmooth.tDom ?? fallback,
        tDomDwellCount: savedSmooth.tDomDwellCount ?? 0,
        frozenTau: savedSmooth.frozenTau ?? savedSmooth.tau ?? 4,
        frozenDim: savedSmooth.frozenDim ?? savedSmooth.dim ?? 5,
        phaseBasis: savedSmooth.phaseBasisE1 && savedSmooth.phaseBasisE1.length > 0
          ? { e1: savedSmooth.phaseBasisE1, e2: savedSmooth.phaseBasisE2 ?? [] }
          : null,
        topologyState: savedSmooth.topologyState
          ? {
              ...(savedSmooth.topologyState as NonNullable<SmoothClockState['topologyState']>),
              speciesCentroids: (savedSmooth.topologyState as Record<string, unknown>).speciesCentroids as NonNullable<SmoothClockState['topologyState']>['speciesCentroids'] ?? [],
            }
          : null,
      }

      if (savedSmooth.goertzelSnapshot) {
        const gCfg = DSP_CONFIG.goertzel
        const maxK = DSP_CONFIG.raw.maxDftK
        const bank = new GoertzelBank(maxK, gCfg.refLength, gCfg.lambda, gCfg.subBinInterp, {
          persistenceDecay: gCfg.persistenceDecay,
          persistenceThreshold: gCfg.persistenceThreshold,
          persistenceWeight: gCfg.persistenceWeight,
          harmonicThreshold: gCfg.harmonicThreshold,
        })
        bank.restore(savedSmooth.goertzelSnapshot)
        smoothState.goertzelBank = bank
      }

      if (savedSmooth.eventBars && savedSmooth.eventBars.length > 0) {
        const lastPrice = savedSmooth.lastClosePrice ?? 0
        if (lastPrice > 0) {
          resampler.restore(savedSmooth.eventBars, savedSmooth.eventTimestamps ?? [], lastPrice)
        }
      }
    }
  } catch {
    // Supabase unavailable or data corrupt — start fresh
  }
}

restorePersistedState()

function runAnalysis(price: number) {
  const bars = resampler.getBars()
  const closePrices = ohlc.getSnapshot().map((b) => b.close)
  post({ type: 'barCount', count: bars.length })

  if (closePrices.length < 32) return

  const rawResult = analyseRaw(closePrices, Math.min(rawWindow, closePrices.length), manualK)
  if (rawResult) {
    post({ type: 'raw', data: rawResult })
  }

  const timestamps = resampler.getTimestamps()
  const smoothResult = analyseSmooth(bars, smoothState, timestamps)
  if (smoothResult) {
    smoothState = smoothResult.state
    const sr = smoothResult.result
    post({ type: 'smooth', data: sr })

    if (!sr.isBootstrapping) {
      const now = Date.now()

      const pr = sr.pipelineReturns
      const pd = sr.pipelineDenoised
      if (pr && pr.length >= 2 && pd && pd.length >= 2) {
        const prev = pr[pr.length - 2]!
        const cur = pr[pr.length - 1]!
        const logRet = prev > 0 ? Math.log(cur / prev) : 0
        const prevD = pd[pd.length - 2]!
        const curD = pd[pd.length - 1]!
        const denoisedRet = prevD > 0 ? Math.log(curD / prevD) : 0
        post({ type: 'priceTick', data: { timestamp: now, price, logReturn: logRet, denoisedReturn: denoisedRet } })
      }

      post({
        type: 'dspTick',
        data: {
          timestamp: now,
          rawPhaseDeg: rawResult?.phaseDeg,
          rawRBar: rawResult?.rBar,
          rawCyclePosition: rawResult?.cyclePosition,
          rawDominantK: rawResult?.dominantK,
          rawMeanPhase: rawResult?.meanPhase,
          smoothPhaseDeg: sr.phaseDeg,
          smoothRBar: sr.rBar,
          vmKappa: sr.vmKappa,
          vmMu: sr.vmMu,
          clockPosition: sr.clockPosition,
          clockVelocity: sr.clockVelocity,
          hmmAlpha: [...sr.hmmAlpha],
          hmmActiveState: sr.hmmActiveState,
          tDom: sr.tDom,
          tDomFrac: sr.tDomFrac,
          goertzelDomK: sr.goertzelDomK,
          goertzelConfidence: sr.goertzelConfidence,
          tau: sr.tau,
          embeddingDim: sr.embeddingDim,
          embedSpan: sr.embedSpan,
          phaseWindow: sr.phaseWindow,
          vmHorizon: sr.vmHorizon,
          vmLambda: sr.vmLambda,
          hmmDwell: sr.hmmDwell,
          hmmPSelf: sr.hmmPSelf,
          barCount: sr.barCount,
          recurrenceRate: sr.recurrenceRate,
          fixedRecurrenceRate: sr.fixedRecurrenceRate,
          corrDimEstimate: sr.corrDimEstimate,
          structureScore: sr.structureScore,
          subspaceStability: sr.subspaceStability,
          rawFrequencies: rawResult?.frequencies,
          goertzelSpectrum: sr.goertzelSpectrum,
          trail: sr.trail,
          ppc: sr.ppc,
          hurst: sr.hurst,
        },
      })

      const lastEntry = smoothState.phaseKappaHistory[smoothState.phaseKappaHistory.length - 1]
      if (lastEntry) {
        post({
          type: 'polarRose',
          data: { timestamp: now, phase: lastEntry.phase, kappa: lastEntry.kappa, regimeId: lastEntry.regimeId },
        })
      }

      post({
        type: 'voxelSnapshot',
        data: {
          timestamp: now,
          embeddingVecs: sr.embeddingVecs,
          recurrenceSize: sr.recurrenceSize,
          recurrenceRate: sr.recurrenceRate,
          fixedRecurrenceRate: sr.fixedRecurrenceRate,
          corrDimEstimate: sr.corrDimEstimate,
          structureScore: sr.structureScore,
        },
      })
    }

    if (smoothState.phaseKappaHistory.length > 0) {
      post({
        type: 'geometry',
        data: {
          history: smoothState.phaseKappaHistory,
          transitions: computeTransitionMatrix(smoothState.phaseKappaHistory),
        },
      })
    }

    if (!sr.isBootstrapping && sr.topologyScore !== undefined) {
      const latestFp = smoothState.topologyState?.fingerprintHistory[smoothState.topologyState.fingerprintHistory.length - 1]
      const defaultFp = {
        timestamp: Date.now(), windingNumber: 0, absWinding: 0, circulation: 0, loopClosure: 0,
        corrDim: 0, recurrenceRate: 0, structureScore: 0, topologyClass: 'drift' as const, kappa: 0,
        meanCurvature: 0, maxCurvature: 0, curvatureVariance: 0, curvatureSkewness: 0,
        curvatureConcentration: 0, meanTorsion: 0, torsionEnergy: 0,
        h0Persistence: 0, h1Peak: 0, h1Persistence: 0, fragmentationRate: 0,
        fourierDescriptors: [] as number[], morphologySpecies: -1,
      }
      post({
        type: 'topology',
        data: {
          windingNumber: sr.windingNumber ?? 0,
          absWinding: sr.absWinding ?? 0,
          circulation: sr.circulation ?? 0,
          loopClosure: sr.loopClosure ?? 0,
          topologyStability: sr.topologyStability ?? 0,
          topologyScore: sr.topologyScore,
          topologyClass: sr.topologyClass ?? 'drift',
          isLoop: (sr.absWinding ?? 0) >= DSP_CONFIG.topology.windingLoopThreshold,
          fingerprint: latestFp ?? defaultFp,
          matchedFingerprints: [],
          morphologySpecies: sr.morphologySpecies ?? -1,
          curvatureProfile: sr.curvatureProfile,
          torsionProfile: sr.torsionProfile,
          meanCurvature: sr.meanCurvature ?? 0,
          maxCurvature: sr.maxCurvature ?? 0,
          curvatureVariance: sr.curvatureVariance ?? 0,
          curvatureConcentration: sr.curvatureConcentration ?? 0,
          meanTorsion: sr.meanTorsion ?? 0,
          torsionEnergy: sr.torsionEnergy ?? 0,
          h0Persistence: sr.h0Persistence ?? 0,
          h1Peak: sr.h1Peak ?? 0,
          h1Persistence: sr.h1Persistence ?? 0,
          fragmentationRate: sr.fragmentationRate ?? 0,
          bettiH0: sr.bettiH0,
          bettiH1: sr.bettiH1,
          bettiThresholds: sr.bettiThresholds,
          fourierDescriptors: sr.fourierDescriptors,
          curvatureSignature: sr.curvatureSignature,
        },
      })
    }

    if (!sr.isBootstrapping && bars.length >= DSP_CONFIG.minBootstrapBars) {
      const snapshot: ClockSnapshot = {
        alpha: smoothState.alpha,
        kappa: smoothState.vmKappa,
        rBar: smoothResult.result.rBar,
        ppc: smoothResult.result.ppc ?? 0,
        hurst: smoothResult.result.hurst ?? 0.5,
        clockPos: smoothState.clockPos,
        price,
        tDom: smoothState.tDom,
        topologyScore: sr.topologyScore ?? 0,
        topologyClass: sr.topologyClass ?? 'drift',
        morphologySpecies: sr.morphologySpecies ?? -1,
        curvatureConcentration: sr.curvatureConcentration ?? 0,
        recurrenceRate: sr.fixedRecurrenceRate ?? sr.recurrenceRate ?? 0,
        structureScore: sr.structureScore ?? 0,
        h1Peak: sr.h1Peak ?? 0,
        h1Persistence: sr.h1Persistence ?? 0,
        fragmentationRate: sr.fragmentationRate ?? 0,
        torsionEnergy: sr.torsionEnergy ?? 0,
        subspaceStability: sr.subspaceStability ?? 0,
      }
      const prevPosition = portfolioState.position
      portfolioState = portfolioTick(portfolioState, snapshot)

      const regimeId = portfolioState.currentRegimeId ?? 0
      const phase = Math.floor(regimeId / 2)
      const dir = regimeDirection(regimeId)
      const crsBreakdown = computeCrs(snapshot, portfolioState.clockVel, portfolioState.kappaPersistence, phase)
      const threshold = TRADING_CONFIG.crs.threshold
      const dirMatch = dir === 1 ? portfolioState.clockVel > 0 : portfolioState.clockVel < 0
      const isTurning = phase === 1 || phase === 3
      const accelMatch = !isTurning || (dir === 1 ? portfolioState.clockAccel > 0 : portfolioState.clockAccel < 0)
      const entered = !prevPosition && portfolioState.position !== null

      post({
        type: 'crsSnapshot',
        data: {
          timestamp: Date.now(),
          regimeId,
          phase,
          direction: dir,
          clockVel: portfolioState.clockVel,
          clockAccel: portfolioState.clockAccel,
          kappaPersistence: portfolioState.kappaPersistence,
          kappa: snapshot.kappa,
          ppc: snapshot.ppc,
          hurst: snapshot.hurst,
          topologyScore: snapshot.topologyScore,
          topologyClass: snapshot.topologyClass,
          recurrenceRate: snapshot.recurrenceRate,
          structureScore: snapshot.structureScore,
          curvatureConcentration: snapshot.curvatureConcentration,
          h1Peak: snapshot.h1Peak,
          torsionEnergy: snapshot.torsionEnergy,
          subspaceStability: snapshot.subspaceStability,
          alphaPhase: snapshot.alpha[phase]!,
          coherenceGroup: crsBreakdown.coherence,
          regimeGroup: crsBreakdown.regime,
          topologyGroup: crsBreakdown.topology,
          geometryGroup: crsBreakdown.geometry,
          trendGroup: crsBreakdown.trend,
          composite: crsBreakdown.composite,
          threshold,
          entered,
          cooldownActive: portfolioState.cooldowns[regimeId]! > 0,
          directionMatch: dirMatch,
          accelMatch,
          price: snapshot.price,
        },
      })

      post({
        type: 'portfolio',
        data: {
          equity: portfolioState.equity,
          position: portfolioState.position,
          trades: portfolioState.trades,
          equityCurve: portfolioState.equityCurve,
          currentRegimeId: portfolioState.currentRegimeId,
          reentryCooldowns: portfolioState.cooldowns,
          returns: portfolioState.returns,
          barCount: portfolioState.barCount,
          gpStates: portfolioState.gps.map((gp) => ({
            inputs: gp.X,
            outputs: gp.y,
            kernelInverse: gp.Kinv,
          })),
        },
      })

      persistState()
    }
  }
}

function postBarTiming(barTime: number) {
  post({ type: 'barTiming', data: { lastBarTime: barTime, intervalMs: ohlc.getIntervalMs() } })
}

function handlePrice(price: number) {
  const closedBar = ohlc.pushTick(price)

  if (closedBar) {
    resampler.pushPrice(closedBar.close, closedBar.time)
    runAnalysis(closedBar.close)
    postBarTiming(closedBar.time)
  }

  const now = performance.now()
  if (now - lastAnalysisTime >= DSP_CONFIG.analysisIntervalMs) {
    lastAnalysisTime = now
    post({ type: 'candles', bars: ohlc.getSnapshot() })
    const current = ohlc.getCurrent()
    if (current) postBarTiming(current.time)
  }
}

function handleBackfill(bars: import('@/services/ohlc/aggregator').OhlcBar[]) {
  if (bars.length === 0) return

  ohlc.loadHistorical(bars)

  const existingTimestamps = resampler.getTimestamps()
  const lastPersistedTs = existingTimestamps.length > 0
    ? existingTimestamps[existingTimestamps.length - 1]!
    : 0

  for (const bar of bars) {
    if (bar.time <= lastPersistedTs) continue
    resampler.pushPrice(bar.close, bar.time)
  }

  const lastBar = bars[bars.length - 1]!
  runAnalysis(lastBar.close)
  post({ type: 'candles', bars: ohlc.getSnapshot() })
  postBarTiming(lastBar.time)
}

self.onmessage = (e: MessageEvent<WorkerInbound>) => {
  const msg = e.data
  switch (msg.type) {
    case 'price':
      handlePrice(msg.price)
      break
    case 'settings':
      rawWindow = msg.rawWindow
      manualK = msg.manualK
      ohlc.setTimeframe(msg.timeframe)
      break
    case 'backfill':
      handleBackfill(msg.bars)
      break
    case 'reset':
      resampler.reset()
      ohlc.reset()
      smoothState = createInitialSmoothState()
      portfolioState = createPortfolioState()
      lastAnalysisTime = 0
      lastPersistTime = 0
      clearPersistedState().catch(() => {})
      break
  }
}
