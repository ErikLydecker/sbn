import { useEffect, useRef, useCallback, startTransition } from 'react'
import { usePriceStore } from '@/stores/price.store'
import { useAnalysisStore } from '@/stores/analysis.store'
import { usePortfolioStore } from '@/stores/portfolio.store'
import { useGeometryStore } from '@/stores/geometry.store'
import { useConnectionStore } from '@/stores/connection.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useCoherenceHistoryStore } from '@/stores/coherence-history.store'
import { useBarTimerStore } from '@/stores/bar-timer.store'
import { useTopologyStore } from '@/stores/topology.store'
import { useMorphologyStore } from '@/stores/morphology.store'
import { useCrsReadinessStore } from '@/stores/crs-readiness.store'
import { ConnectionManager } from '@/services/binance/connection-manager'
import { fetchHistoricalKlines } from '@/services/binance/klines'
import {
  appendCoherencePoints,
  appendPriceTicks,
  appendDspTicks,
  appendPolarRosePoints,
  appendVoxelSnapshots,
  appendTopologySnapshots,
  appendMorphologyHistory,
  upsertSpeciesCatalog,
  pruneTables,
} from '@/services/persistence/db'
import type { PriceTick, DspTick, PolarRosePoint, VoxelSnapshot, TopologySnapshotRow, MorphologyHistoryRow } from '@/services/persistence/db'
import { fingerprintToVector } from '@/core/dsp/topology'
import { computeShapeMetrics } from '@/core/dsp/shape-metrics'
import { BINANCE_CONFIG } from '@/config/binance'
import { DSP_CONFIG } from '@/config/dsp'
import type { WorkerInbound, WorkerOutbound } from '@/workers/dsp.messages'

let priceTickBuffer: PriceTick[] = []
let dspTickBuffer: DspTick[] = []
let polarRoseBuffer: PolarRosePoint[] = []
let voxelBuffer: VoxelSnapshot[] = []
let topologyBuffer: TopologySnapshotRow[] = []
let morphologyBuffer: MorphologyHistoryRow[] = []

export function useDspWorker() {
  const workerRef = useRef<Worker | null>(null)
  const connRef = useRef<ConnectionManager | null>(null)

  const pushPrice = usePriceStore((s) => s.pushPrice)
  const setCandles = usePriceStore((s) => s.setCandles)
  const setRaw = useAnalysisStore((s) => s.setRaw)
  const setSmooth = useAnalysisStore((s) => s.setSmooth)
  const setEventBarCount = useAnalysisStore((s) => s.setEventBarCount)
  const updatePortfolio = usePortfolioStore((s) => s.updateFromWorker)
  const setGeometry = useGeometryStore((s) => s.setGeometry)
  const setConnectionStatus = useConnectionStore((s) => s.setStatus)
  const setConnectionHealth = useConnectionStore((s) => s.setHealth)
  const pushCoherence = useCoherenceHistoryStore((s) => s.push)
  const flushCoherence = useCoherenceHistoryStore((s) => s.flush)
  const setBarTiming = useBarTimerStore((s) => s.setTiming)
  const pushTopology = useTopologyStore((s) => s.push)
  const pushShape = useTopologyStore((s) => s.pushShape)
  const pushMorphology = useMorphologyStore((s) => s.push)
  const recordMorphologyTrade = useMorphologyStore((s) => s.recordTradeResult)
  const pushCrs = useCrsReadinessStore((s) => s.push)

  const rawWindow = useSettingsStore((s) => s.rawWindow)
  const manualK = useSettingsStore((s) => s.manualFrequencyK)
  const timeframe = useSettingsStore((s) => s.timeframe)

  const backfillToWorker = useCallback((worker: Worker) => {
    const backfillLimit = DSP_CONFIG.tDom.maxLookback
    console.debug('[sbn] backfill: fetching %d klines (%s)', backfillLimit, timeframe)
    fetchHistoricalKlines(BINANCE_CONFIG.symbol, timeframe, backfillLimit)
      .then((bars) => {
        console.debug('[sbn] backfill: got %d bars, sending to worker', bars.length)
        const backfillMsg: WorkerInbound = { type: 'backfill', bars }
        worker.postMessage(backfillMsg)
      })
      .catch((err) => {
        console.error('[sbn] kline backfill failed:', err)
      })
  }, [timeframe])

  useEffect(() => {
    const worker = new Worker(
      new URL('@/workers/dsp.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    let msgCount = 0
    worker.onmessage = (e: MessageEvent<WorkerOutbound>) => {
      const msg = e.data
      msgCount++
      if (msgCount <= 3 || msgCount % 50 === 0) {
        console.debug('[sbn] worker msg #%d: %s', msgCount, msg.type)
      }

      switch (msg.type) {
        case 'priceTick':
          priceTickBuffer.push(msg.data)
          return
        case 'dspTick':
          dspTickBuffer.push(msg.data)
          return
        case 'polarRose':
          polarRoseBuffer.push(msg.data)
          return
        case 'voxelSnapshot':
          voxelBuffer.push(msg.data)
          return
        case 'crsSnapshot':
          pushCrs(msg.data)
          return
        case 'barTiming':
          setBarTiming(msg.data.lastBarTime, msg.data.intervalMs)
          return
      }

      startTransition(() => {
        switch (msg.type) {
          case 'raw':
            setRaw(msg.data)
            break
          case 'smooth':
            setSmooth(msg.data)
            if (msg.data.isBootstrapping) {
              if (msgCount <= 5) console.debug('[sbn] bootstrapping: %d%%', Math.round(msg.data.bootstrapProgress * 100))
            } else {
              pushCoherence(msg.data.rBar, msg.data.vmKappa, msg.data.recurrenceRate, msg.data.fixedRecurrenceRate, msg.data.structureScore, msg.data.tDom, msg.data.windingNumber, msg.data.topologyScore, msg.data.topologyClass, msg.data.ppc, msg.data.hurst)
              if (msg.data.embeddingVecs && msg.data.embeddingVecs.length >= 4) {
                const shape = computeShapeMetrics(msg.data.embeddingVecs, Date.now())
                if (shape) pushShape(shape)
              }
            }
            break
          case 'portfolio': {
            const prevTradeCount = usePortfolioStore.getState().trades.length
            updatePortfolio(msg.data)
            if (msg.data.trades.length > prevTradeCount) {
              for (let ti = prevTradeCount; ti < msg.data.trades.length; ti++) {
                const t = msg.data.trades[ti]!
                if (t.entryMorphologySpecies !== undefined && t.entryMorphologySpecies >= 0) {
                  recordMorphologyTrade(t.entryMorphologySpecies, t.regimeId, t.returnPct)
                }
              }
            }
            break
          }
          case 'geometry':
            setGeometry(msg.data)
            break
          case 'barCount':
            setEventBarCount(msg.count)
            break
          case 'candles':
            setCandles(msg.bars)
            break
          case 'topology':
            pushTopology(msg.data)
            pushMorphology(msg.data)
            topologyBuffer.push({
              timestamp: msg.data.fingerprint.timestamp,
              windingNumber: msg.data.windingNumber,
              absWinding: msg.data.absWinding,
              circulation: msg.data.circulation,
              loopClosure: msg.data.loopClosure,
              corrDim: msg.data.fingerprint.corrDim,
              recurrenceRate: msg.data.fingerprint.recurrenceRate,
              structureScore: msg.data.fingerprint.structureScore,
              topologyClass: msg.data.topologyClass,
              topologyScore: msg.data.topologyScore,
              kappa: msg.data.fingerprint.kappa,
              fingerprintVector: fingerprintToVector(msg.data.fingerprint),
            })
            morphologyBuffer.push({
              timestamp: msg.data.fingerprint.timestamp,
              mean_curvature: msg.data.meanCurvature,
              max_curvature: msg.data.maxCurvature,
              curvature_concentration: msg.data.curvatureConcentration,
              torsion_energy: msg.data.torsionEnergy,
              species: msg.data.morphologySpecies,
            })
            break
        }
      })
    }

    let priceCount = 0
    const conn = new ConnectionManager({
      onPrice: (price) => {
        priceCount++
        if (priceCount === 1) console.debug('[sbn] first price: $%s', price.toFixed(2))
        pushPrice(price)
        const msg: WorkerInbound = { type: 'price', price }
        worker.postMessage(msg)
      },
      onStatusChange: (status) => {
        console.debug('[sbn] ws: %s', status.status, 'source' in status ? status.source : '')
        setConnectionStatus(status)
      },
      onHealthChange: setConnectionHealth,
      onGapDetected: () => {
        backfillToWorker(worker)
      },
    })
    connRef.current = conn

    console.debug('[sbn] starting pipeline')
    backfillToWorker(worker)
    conn.start()

    return () => {
      conn.stop()
      worker.terminate()
      workerRef.current = null
      connRef.current = null
    }
  }, [pushPrice, setCandles, setRaw, setSmooth, setEventBarCount, updatePortfolio, setGeometry, setConnectionStatus, setConnectionHealth, timeframe, backfillToWorker, pushTopology, pushShape, pushMorphology, recordMorphologyTrade, pushCrs])

  useEffect(() => {
    const worker = workerRef.current
    if (!worker) return
    const msg: WorkerInbound = { type: 'settings', rawWindow, manualK, timeframe }
    worker.postMessage(msg)
  }, [rawWindow, manualK, timeframe])

  useEffect(() => {
    const logErr = (table: string) => (err: unknown) => {
      console.error('[sbn] %s insert failed:', table, err)
    }

    const id = setInterval(() => {
      const coherenceBatch = flushCoherence()
      if (coherenceBatch.length > 0) appendCoherencePoints(coherenceBatch).catch(logErr('coherence'))

      const priceBatch = priceTickBuffer; priceTickBuffer = []
      if (priceBatch.length > 0) appendPriceTicks(priceBatch).catch(logErr('price_series'))

      const dspBatch = dspTickBuffer; dspTickBuffer = []
      if (dspBatch.length > 0) appendDspTicks(dspBatch).catch(logErr('dsp_ticks'))

      const polarBatch = polarRoseBuffer; polarRoseBuffer = []
      if (polarBatch.length > 0) appendPolarRosePoints(polarBatch).catch(logErr('polar_rose'))

      const voxelBatch = voxelBuffer; voxelBuffer = []
      if (voxelBatch.length > 0) appendVoxelSnapshots(voxelBatch).catch(logErr('voxel_snapshots'))

      const topoBatch = topologyBuffer; topologyBuffer = []
      if (topoBatch.length > 0) appendTopologySnapshots(topoBatch).catch(logErr('topology_snapshots'))

      const morphBatch = morphologyBuffer; morphologyBuffer = []
      if (morphBatch.length > 0) appendMorphologyHistory(morphBatch).catch(logErr('morphology_history'))

      const catalog = useMorphologyStore.getState().speciesCatalog
      if (catalog.length > 0) {
        upsertSpeciesCatalog(catalog.map((e) => ({
          id: e.id,
          count: e.count,
          total_return: e.totalReturn,
          wins: e.wins,
          avg_curvature_concentration: e.avgCurvatureConcentration,
          avg_h1_peak: e.avgH1Peak,
          last_seen: e.lastSeen,
          regime_returns: e.regimeReturns,
        }))).catch(logErr('species_catalog'))
      }
    }, 10_000)

    const pruneId = setInterval(() => {
      pruneTables().catch(logErr('prune'))
    }, 300_000)

    return () => {
      clearInterval(id)
      clearInterval(pruneId)
    }
  }, [flushCoherence])
}
