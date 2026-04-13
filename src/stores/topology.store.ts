import { create } from 'zustand'
import type { TopologyFingerprint, FingerprintMatch, TopologyClass } from '@/core/dsp/topology'
import type { TopologySnapshotRow } from '@/services/persistence/db'
import type { ShapeMetrics } from '@/core/dsp/shape-metrics'

export interface TopologyLiveResult {
  windingNumber: number
  absWinding: number
  circulation: number
  loopClosure: number
  topologyStability: number
  topologyScore: number
  topologyClass: TopologyClass
  isLoop: boolean
  fingerprint: TopologyFingerprint
  matchedFingerprints: FingerprintMatch[]
}

export interface TopologyStoreState {
  fingerprints: TopologySnapshotRow[]
  currentMatches: FingerprintMatch[]
  liveResult: TopologyLiveResult | null
  currentShape: ShapeMetrics | null
  shapeHistory: ShapeMetrics[]
  loaded: boolean
  push: (result: TopologyLiveResult) => void
  pushShape: (metrics: ShapeMetrics) => void
  loadShapes: (shapes: ShapeMetrics[]) => void
  load: (rows: TopologySnapshotRow[]) => void
  reset: () => void
}

const MAX_FINGERPRINTS = 500
const MAX_SHAPE_HISTORY = 30

export const useTopologyStore = create<TopologyStoreState>((set) => ({
  fingerprints: [],
  currentMatches: [],
  liveResult: null,
  currentShape: null,
  shapeHistory: [],
  loaded: false,

  push: (result) => {
    set((s) => ({
      liveResult: result,
      currentMatches: result.matchedFingerprints,
      fingerprints: [...s.fingerprints, {
        timestamp: result.fingerprint.timestamp,
        windingNumber: result.fingerprint.windingNumber,
        absWinding: result.fingerprint.absWinding,
        circulation: result.fingerprint.circulation,
        loopClosure: result.fingerprint.loopClosure,
        corrDim: result.fingerprint.corrDim,
        recurrenceRate: result.fingerprint.recurrenceRate,
        structureScore: result.fingerprint.structureScore,
        topologyClass: result.fingerprint.topologyClass,
        topologyScore: result.topologyScore,
        kappa: result.fingerprint.kappa,
        fingerprintVector: [
          result.fingerprint.absWinding,
          result.fingerprint.circulation,
          result.fingerprint.loopClosure,
          result.fingerprint.corrDim,
          result.fingerprint.recurrenceRate,
          result.fingerprint.structureScore,
          result.fingerprint.kappa,
        ],
      }].slice(-MAX_FINGERPRINTS),
    }))
  },

  pushShape: (metrics) => {
    set((s) => ({
      currentShape: metrics,
      shapeHistory: [...s.shapeHistory, metrics].slice(-MAX_SHAPE_HISTORY),
    }))
  },

  loadShapes: (shapes) => {
    const trimmed = shapes.slice(-MAX_SHAPE_HISTORY)
    set({
      shapeHistory: trimmed,
      currentShape: trimmed.length > 0 ? trimmed[trimmed.length - 1]! : null,
    })
  },

  load: (rows) => {
    set({ fingerprints: rows.slice(-MAX_FINGERPRINTS), loaded: true })
  },

  reset: () => {
    set({ fingerprints: [], currentMatches: [], liveResult: null, currentShape: null, shapeHistory: [], loaded: false })
  },
}))
