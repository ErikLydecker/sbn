import { create } from 'zustand'
import type { PriceTick } from '@/services/persistence/db'

const MAX_POINTS = 2000

interface PriceSeriesState {
  ticks: PriceTick[]
  push: (tick: PriceTick) => void
  load: (ticks: PriceTick[]) => void
  reset: () => void
}

export const usePriceSeriesStore = create<PriceSeriesState>((set) => ({
  ticks: [],

  push: (tick) =>
    set((s) => {
      const next = [...s.ticks, tick]
      if (next.length > MAX_POINTS) next.splice(0, next.length - MAX_POINTS)
      return { ticks: next }
    }),

  load: (ticks) => set({ ticks: ticks.slice(-MAX_POINTS) }),

  reset: () => set({ ticks: [] }),
}))
