import { create } from 'zustand'

export interface PhaseKappaEntry {
  phase: number
  kappa: number
  regimeId: number
}

export interface GeometryPayload {
  history: PhaseKappaEntry[]
  transitions: number[]
}

interface GeometryState {
  history: PhaseKappaEntry[]
  transitions: number[]
  setGeometry: (data: GeometryPayload) => void
  reset: () => void
}

export const useGeometryStore = create<GeometryState>((set) => ({
  history: [],
  transitions: new Array(64).fill(0) as number[],

  setGeometry: (data) => set({ history: data.history, transitions: data.transitions }),
  reset: () => set({ history: [], transitions: new Array(64).fill(0) as number[] }),
}))
