import { create } from 'zustand'
import type { RawAnalysis, SmoothAnalysis } from '@/schemas/analysis'

interface AnalysisState {
  raw: RawAnalysis | null
  smooth: SmoothAnalysis | null
  eventBarCount: number
  lastAnalysisAt: number
  setRaw: (raw: RawAnalysis) => void
  setSmooth: (smooth: SmoothAnalysis) => void
  setEventBarCount: (count: number) => void
  reset: () => void
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  raw: null,
  smooth: null,
  eventBarCount: 0,
  lastAnalysisAt: 0,

  setRaw: (raw) => set({ raw }),
  setSmooth: (smooth) => set({ smooth, lastAnalysisAt: Date.now() }),
  setEventBarCount: (count) => set({ eventBarCount: count }),
  reset: () => set({ raw: null, smooth: null, eventBarCount: 0, lastAnalysisAt: 0 }),
}))
