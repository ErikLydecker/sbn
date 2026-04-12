import { create } from 'zustand'
import type { DspTick } from '@/services/persistence/db'

const MAX_TICKS = 500

interface DspTicksState {
  ticks: DspTick[]
  latest: DspTick | null
  push: (tick: DspTick) => void
  load: (ticks: DspTick[]) => void
  reset: () => void
}

export const useDspTicksStore = create<DspTicksState>((set) => ({
  ticks: [],
  latest: null,

  push: (tick) =>
    set((s) => {
      const next = [...s.ticks, tick]
      if (next.length > MAX_TICKS) next.splice(0, next.length - MAX_TICKS)
      return { ticks: next, latest: tick }
    }),

  load: (ticks) => set({ ticks: ticks.slice(-MAX_TICKS), latest: ticks[ticks.length - 1] ?? null }),

  reset: () => set({ ticks: [], latest: null }),
}))
