import { create } from 'zustand'
import type { CrsSnapshotData } from '@/workers/dsp.messages'

const MAX_SNAPSHOTS = 300

interface CrsReadinessState {
  snapshots: CrsSnapshotData[]
  push: (snap: CrsSnapshotData) => void
  clear: () => void
}

export const useCrsReadinessStore = create<CrsReadinessState>((set) => ({
  snapshots: [],
  push: (snap) =>
    set((s) => {
      const next = [...s.snapshots, snap]
      return { snapshots: next.length > MAX_SNAPSHOTS ? next.slice(-MAX_SNAPSHOTS) : next }
    }),
  clear: () => set({ snapshots: [] }),
}))
