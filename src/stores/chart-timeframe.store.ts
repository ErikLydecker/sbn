import { create } from 'zustand'

export type ChartRangeMinutes = 60 | 120 | 180

export interface ChartTimeframeState {
  range: ChartRangeMinutes
  setRange: (minutes: ChartRangeMinutes) => void
}

export const useChartTimeframeStore = create<ChartTimeframeState>((set) => ({
  range: 60,
  setRange: (minutes) => set({ range: minutes }),
}))

export function getVisibleRange(rangeMinutes: number): { from: number; to: number } {
  const to = Math.floor(Date.now() / 1000)
  const from = to - rangeMinutes * 60
  return { from, to }
}
