import { create } from 'zustand'
import type { ConnectionStatus, ConnectionHealth } from '@/schemas/price'

const initialHealth: ConnectionHealth = {
  connectedSince: null,
  uptimeMs: 0,
  totalReconnects: 0,
  lastMessageAt: null,
  messagesReceived: 0,
  currentSource: null,
  consecutiveFailures: 0,
}

interface ConnectionState {
  status: ConnectionStatus
  health: ConnectionHealth
  setStatus: (status: ConnectionStatus) => void
  setHealth: (health: ConnectionHealth) => void
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: { status: 'idle' },
  health: initialHealth,
  setStatus: (status: ConnectionStatus) => set({ status }),
  setHealth: (health: ConnectionHealth) => set({ health }),
}))
