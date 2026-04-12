import { create } from 'zustand'
import type { PolarRosePoint } from '@/services/persistence/db'

const MAX_POINTS = 3000

interface PolarRoseState {
  points: PolarRosePoint[]
  push: (point: PolarRosePoint) => void
  load: (points: PolarRosePoint[]) => void
  reset: () => void
}

export const usePolarRoseStore = create<PolarRoseState>((set) => ({
  points: [],

  push: (point) =>
    set((s) => {
      const next = [...s.points, point]
      if (next.length > MAX_POINTS) next.splice(0, next.length - MAX_POINTS)
      return { points: next }
    }),

  load: (points) => set({ points: points.slice(-MAX_POINTS) }),

  reset: () => set({ points: [] }),
}))
