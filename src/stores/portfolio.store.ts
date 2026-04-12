import { create } from 'zustand'
import type { OpenPosition, ClosedTrade } from '@/schemas/trade'
import type { RegimeId } from '@/schemas/regime'
import type { GpState } from '@/schemas/portfolio'
import { TRADING_CONFIG } from '@/config/trading'

interface PortfolioState {
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

  updateFromWorker: (snapshot: PortfolioWorkerSnapshot) => void
  reset: () => void
}

export interface PortfolioWorkerSnapshot {
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

const createInitialGpStates = (): GpState[] =>
  Array.from({ length: 8 }, () => ({ inputs: [], outputs: [], kernelInverse: null }))

export const usePortfolioStore = create<PortfolioState>((set) => ({
  equity: TRADING_CONFIG.initialEquity,
  initialEquity: TRADING_CONFIG.initialEquity,
  position: null,
  trades: [],
  equityCurve: [TRADING_CONFIG.initialEquity],
  currentRegimeId: null,
  reentryCooldowns: new Array(8).fill(0),
  returns: [],
  barCount: 0,
  gpStates: createInitialGpStates(),

  updateFromWorker: (snapshot) => set(snapshot),

  reset: () =>
    set({
      equity: TRADING_CONFIG.initialEquity,
      position: null,
      trades: [],
      equityCurve: [TRADING_CONFIG.initialEquity],
      currentRegimeId: null,
      reentryCooldowns: new Array(8).fill(0),
      returns: [],
      barCount: 0,
      gpStates: createInitialGpStates(),
    }),
}))
