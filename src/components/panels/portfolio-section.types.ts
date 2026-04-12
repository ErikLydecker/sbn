import type { OpenPosition, ClosedTrade } from '@/schemas/trade'
import type { RegimeId } from '@/schemas/regime'
import type { GpState } from '@/schemas/portfolio'

export interface PortfolioState {
  equity: number
  initialEquity: number
  position: OpenPosition | null
  trades: ClosedTrade[]
  equityCurve: number[]
  currentRegimeId: RegimeId | null
  reentryCooldowns: number[]
  returns: number[]
  barCount: number
  gpStates: GpState[]
}
