import { EventClockResampler } from '@/services/event-clock/resampler'
import { OhlcAggregator } from '@/services/ohlc/aggregator'
import { analyseRaw, analyseSmooth, createInitialSmoothState, computeTransitionMatrix } from '@/core/dsp/pipeline'
import type { SmoothClockState } from '@/core/dsp/pipeline'
import { portfolioTick, createPortfolioState, restorePortfolioState } from '@/core/trading/engine'
import type { PortfolioState, ClockSnapshot } from '@/core/trading/engine'
import type { WorkerInbound, WorkerOutbound } from './dsp.messages'
import { DSP_CONFIG } from '@/config/dsp'
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

  const smoothResult = analyseSmooth(bars, smoothState)
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
          corrDimEstimate: sr.corrDimEstimate,
          structureScore: sr.structureScore,
          rawFrequencies: rawResult?.frequencies,
          goertzelSpectrum: sr.goertzelSpectrum,
          trail: sr.trail,
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

    if (!sr.isBootstrapping && smoothState.vmKappa >= 0.1 && bars.length >= DSP_CONFIG.minBootstrapBars) {
      const snapshot: ClockSnapshot = {
        alpha: smoothState.alpha,
        kappa: smoothState.vmKappa,
        rBar: smoothResult.result.rBar,
        clockPos: smoothState.clockPos,
        price,
        tDom: smoothState.tDom,
      }
      portfolioState = portfolioTick(portfolioState, snapshot)

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

function handlePrice(price: number) {
  const closedBar = ohlc.pushTick(price)

  if (closedBar) {
    resampler.pushPrice(closedBar.close)
    runAnalysis(closedBar.close)
  }

  const now = performance.now()
  if (now - lastAnalysisTime >= DSP_CONFIG.analysisIntervalMs) {
    lastAnalysisTime = now
    post({ type: 'candles', bars: ohlc.getSnapshot() })
  }
}

function handleBackfill(bars: import('@/services/ohlc/aggregator').OhlcBar[]) {
  if (bars.length === 0) return

  ohlc.loadHistorical(bars)

  for (const bar of bars) {
    resampler.pushPrice(bar.close)
  }

  const lastClose = bars[bars.length - 1]!.close
  runAnalysis(lastClose)
  post({ type: 'candles', bars: ohlc.getSnapshot() })
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
