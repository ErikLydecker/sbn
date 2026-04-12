import { create } from 'zustand'
import type { VoxelSnapshot } from '@/services/persistence/db'

interface VoxelState {
  latest: VoxelSnapshot | null
  push: (snapshot: VoxelSnapshot) => void
  load: (snapshot: VoxelSnapshot | null) => void
  reset: () => void
}

export const useVoxelStore = create<VoxelState>((set) => ({
  latest: null,

  push: (snapshot) => set({ latest: snapshot }),

  load: (snapshot) => set({ latest: snapshot }),

  reset: () => set({ latest: null }),
}))
