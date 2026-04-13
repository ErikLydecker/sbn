import { create } from 'zustand'

interface BarTimerState {
  lastBarTime: number
  intervalMs: number
  setTiming: (lastBarTime: number, intervalMs: number) => void
}

export const useBarTimerStore = create<BarTimerState>((set) => ({
  lastBarTime: 0,
  intervalMs: 60_000,
  setTiming: (lastBarTime, intervalMs) => set({ lastBarTime, intervalMs }),
}))
