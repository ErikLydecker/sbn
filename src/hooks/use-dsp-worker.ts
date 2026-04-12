import { useEffect, useRef, useCallback } from 'react'
import { usePriceStore } from '@/stores/price.store'
import { useAnalysisStore } from '@/stores/analysis.store'
import { usePortfolioStore } from '@/stores/portfolio.store'
import { useGeometryStore } from '@/stores/geometry.store'
import { useConnectionStore } from '@/stores/connection.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useCoherenceHistoryStore } from '@/stores/coherence-history.store'
import { ConnectionManager } from '@/services/binance/connection-manager'
import { fetchHistoricalKlines } from '@/services/binance/klines'
import { loadCoherenceHistory, appendCoherencePoints, appendPriceTicks } from '@/services/persistence/db'
import type { PriceTick } from '@/services/persistence/db'
import { BINANCE_CONFIG } from '@/config/binance'
import { DSP_CONFIG } from '@/config/dsp'
import type { WorkerInbound, WorkerOutbound } from '@/workers/dsp.messages'

let priceTickBuffer: PriceTick[] = []

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
  const loadCoherence = useCoherenceHistoryStore((s) => s.load)
  const flushCoherence = useCoherenceHistoryStore((s) => s.flush)
  const coherenceLoaded = useCoherenceHistoryStore((s) => s.loaded)

  const rawWindow = useSettingsStore((s) => s.rawWindow)
  const manualK = useSettingsStore((s) => s.manualFrequencyK)
  const timeframe = useSettingsStore((s) => s.timeframe)

  const backfillToWorker = useCallback((worker: Worker) => {
    const backfillLimit = DSP_CONFIG.tDom.maxLookback
    fetchHistoricalKlines(BINANCE_CONFIG.symbol, timeframe, backfillLimit)
      .then((bars) => {
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

    worker.onmessage = (e: MessageEvent<WorkerOutbound>) => {
      const msg = e.data
      switch (msg.type) {
        case 'raw':
          setRaw(msg.data)
          break
        case 'smooth':
          setSmooth(msg.data)
          if (!msg.data.isBootstrapping) {
            pushCoherence(msg.data.rBar, msg.data.vmKappa, msg.data.recurrenceRate, msg.data.structureScore, msg.data.tDom)
          }
          break
        case 'portfolio':
          updatePortfolio(msg.data)
          break
        case 'geometry':
          setGeometry(msg.data)
          break
        case 'barCount':
          setEventBarCount(msg.count)
          break
        case 'priceTick':
          priceTickBuffer.push(msg.data)
          break
        case 'candles':
          setCandles(msg.bars)
          break
      }
    }

    const conn = new ConnectionManager({
      onPrice: (price) => {
        pushPrice(price)
        const msg: WorkerInbound = { type: 'price', price }
        worker.postMessage(msg)
      },
      onStatusChange: setConnectionStatus,
      onHealthChange: setConnectionHealth,
      onGapDetected: () => {
        backfillToWorker(worker)
      },
    })
    connRef.current = conn

    backfillToWorker(worker)
    conn.start()

    return () => {
      conn.stop()
      worker.terminate()
      workerRef.current = null
      connRef.current = null
    }
  }, [pushPrice, setCandles, setRaw, setSmooth, setEventBarCount, updatePortfolio, setGeometry, setConnectionStatus, setConnectionHealth, timeframe, backfillToWorker])

  useEffect(() => {
    const worker = workerRef.current
    if (!worker) return
    const msg: WorkerInbound = { type: 'settings', rawWindow, manualK, timeframe }
    worker.postMessage(msg)
  }, [rawWindow, manualK, timeframe])

  useEffect(() => {
    if (coherenceLoaded) return
    loadCoherenceHistory()
      .then((pts) => loadCoherence(pts))
      .catch(() => {})
  }, [coherenceLoaded, loadCoherence])

  useEffect(() => {
    const id = setInterval(() => {
      const batch = flushCoherence()
      if (batch.length > 0) appendCoherencePoints(batch).catch(() => {})

      const priceBatch = priceTickBuffer
      priceTickBuffer = []
      if (priceBatch.length > 0) appendPriceTicks(priceBatch).catch(() => {})
    }, 10_000)
    return () => clearInterval(id)
  }, [flushCoherence])
}
