import type { RawAnalysis, SmoothAnalysis } from '@/schemas/analysis'
import type { OpenPosition, ClosedTrade } from '@/schemas/trade'
import type { RegimeId } from '@/schemas/regime'
import type { GpState } from '@/schemas/portfolio'
import type { Timeframe } from '@/schemas/settings'
import type { OhlcBar } from '@/services/ohlc/aggregator'

export type WorkerInbound =
  | { type: 'price'; price: number }
  | { type: 'settings'; rawWindow: number; manualK: number | null; timeframe: Timeframe }
  | { type: 'backfill'; bars: OhlcBar[] }
  | { type: 'reset' }

export interface GeometryWorkerData {
  history: { phase: number; kappa: number; regimeId: number }[]
  transitions: number[]
}

export interface PriceTickData {
  timestamp: number
  price: number
  logReturn: number
  denoisedReturn: number
}

export type WorkerOutbound =
  | { type: 'raw'; data: RawAnalysis }
  | { type: 'smooth'; data: SmoothAnalysis }
  | { type: 'portfolio'; data: PortfolioWorkerData }
  | { type: 'geometry'; data: GeometryWorkerData }
  | { type: 'priceTick'; data: PriceTickData }
  | { type: 'barCount'; count: number }
  | { type: 'candles'; bars: OhlcBar[] }

export interface PortfolioWorkerData {
  equity: number
  position: OpenPosition | null
  trades: ClosedTrade[]
  equityCurve: number[]
  currentRegimeId: RegimeId | null
  reentryCooldowns: number[]
  returns: number[]
  barCount: number
  gpStates: GpState[]
}
