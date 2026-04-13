import { create } from 'zustand'
import type { CoherencePoint } from '@/services/persistence/db'

const MAX_MEMORY_POINTS = 2000

export interface CoherenceHistoryState {
  points: CoherencePoint[]
  loaded: boolean
  push: (rBar: number, kappa: number, recurrenceRate?: number, fixedRecurrenceRate?: number, structureScore?: number, tDom?: number, windingNumber?: number, topologyScore?: number, topologyClass?: string, ppc?: number, hurst?: number) => void
  load: (persisted: CoherencePoint[]) => void
  flush: () => CoherencePoint[]
  reset: () => void
}

let unflushed: CoherencePoint[] = []

export const useCoherenceHistoryStore = create<CoherenceHistoryState>((set) => ({
  points: [],
  loaded: false,

  push: (rBar, kappa, recurrenceRate?, fixedRecurrenceRate?, structureScore?, tDom?, windingNumber?, topologyScore?, topologyClass?, ppc?, hurst?) => {
    const pt: CoherencePoint = { timestamp: Date.now(), rBar, kappa, recurrenceRate, fixedRecurrenceRate, structureScore, tDom, windingNumber, topologyScore, topologyClass, ppc, hurst }
    unflushed.push(pt)
    set((s) => {
      const next = [...s.points, pt]
      if (next.length > MAX_MEMORY_POINTS) next.splice(0, next.length - MAX_MEMORY_POINTS)
      return { points: next }
    })
  },

  load: (persisted) => {
    set({ points: persisted.slice(-MAX_MEMORY_POINTS), loaded: true })
  },

  flush: () => {
    const batch = unflushed
    unflushed = []
    return batch
  },

  reset: () => {
    unflushed = []
    set({ points: [], loaded: false })
  },
}))
