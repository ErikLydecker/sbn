import { create } from 'zustand'
import type { OhlcBar } from '@/services/ohlc/aggregator'

interface PriceState {
  candles: OhlcBar[]
  latestPrice: number
  openPrice: number
  pushPrice: (price: number) => void
  setCandles: (bars: OhlcBar[]) => void
  reset: () => void
}

export const usePriceStore = create<PriceState>((set, get) => ({
  candles: [],
  latestPrice: 0,
  openPrice: 0,

  pushPrice: (price: number) => {
    if (!price || isNaN(price) || price <= 0) return
    const state = get()
    set({
      latestPrice: price,
      openPrice: state.openPrice === 0 ? price : state.openPrice,
    })
  },

  setCandles: (candles: OhlcBar[]) => {
    const last = candles[candles.length - 1]
    set({
      candles,
      latestPrice: last?.close ?? 0,
    })
  },

  reset: () => set({ candles: [], latestPrice: 0, openPrice: 0 }),
}))
