import { create } from 'zustand'
import type { TopologyWorkerData } from '@/workers/dsp.messages'

export interface SpeciesCatalogEntry {
  id: number
  count: number
  totalReturn: number
  wins: number
  avgCurvatureConcentration: number
  avgH1Peak: number
  lastSeen: number
  regimeReturns: Record<number, { sum: number; count: number }>
}

export interface CurvatureHistoryPoint {
  t: number
  mean: number
  max: number
  concentration: number
}

export interface TorsionHistoryPoint {
  t: number
  energy: number
}

export interface SpeciesHistoryPoint {
  t: number
  species: number
  regimeId?: number
}

export interface MorphologyStoreState {
  curvatureProfile: number[]
  torsionProfile: number[]
  bettiH0: number[]
  bettiH1: number[]
  bettiThresholds: number[]
  fourierDescriptors: number[]
  curvatureSignature: number[]
  currentSpecies: number

  curvatureHistory: CurvatureHistoryPoint[]
  torsionHistory: TorsionHistoryPoint[]
  speciesHistory: SpeciesHistoryPoint[]
  speciesCatalog: SpeciesCatalogEntry[]

  push: (data: TopologyWorkerData) => void
  recordTradeResult: (species: number, regimeId: number, returnPct: number) => void
  reset: () => void
}

const MAX_HISTORY = 500

function ensureCatalogEntry(catalog: SpeciesCatalogEntry[], id: number): SpeciesCatalogEntry[] {
  if (catalog.some((e) => e.id === id)) return catalog
  return [...catalog, {
    id,
    count: 0,
    totalReturn: 0,
    wins: 0,
    avgCurvatureConcentration: 0,
    avgH1Peak: 0,
    lastSeen: 0,
    regimeReturns: {},
  }]
}

export const useMorphologyStore = create<MorphologyStoreState>((set) => ({
  curvatureProfile: [],
  torsionProfile: [],
  bettiH0: [],
  bettiH1: [],
  bettiThresholds: [],
  fourierDescriptors: [],
  curvatureSignature: [],
  currentSpecies: -1,

  curvatureHistory: [],
  torsionHistory: [],
  speciesHistory: [],
  speciesCatalog: [],

  push: (data) => {
    set((s) => {
      const now = Date.now()
      const species = data.morphologySpecies

      let catalog = ensureCatalogEntry(s.speciesCatalog, species)
      catalog = catalog.map((e) => {
        if (e.id !== species) return e
        const newCount = e.count + 1
        return {
          ...e,
          count: newCount,
          avgCurvatureConcentration: e.avgCurvatureConcentration + (data.curvatureConcentration - e.avgCurvatureConcentration) / newCount,
          avgH1Peak: e.avgH1Peak + (data.h1Peak - e.avgH1Peak) / newCount,
          lastSeen: now,
        }
      })

      return {
        curvatureProfile: data.curvatureProfile ?? s.curvatureProfile,
        torsionProfile: data.torsionProfile ?? s.torsionProfile,
        bettiH0: data.bettiH0 ?? s.bettiH0,
        bettiH1: data.bettiH1 ?? s.bettiH1,
        bettiThresholds: data.bettiThresholds ?? s.bettiThresholds,
        fourierDescriptors: data.fourierDescriptors ?? s.fourierDescriptors,
        curvatureSignature: data.curvatureSignature ?? s.curvatureSignature,
        currentSpecies: species,

        curvatureHistory: [...s.curvatureHistory, {
          t: now,
          mean: data.meanCurvature,
          max: data.maxCurvature,
          concentration: data.curvatureConcentration,
        }].slice(-MAX_HISTORY),

        torsionHistory: [...s.torsionHistory, {
          t: now,
          energy: data.torsionEnergy,
        }].slice(-MAX_HISTORY),

        speciesHistory: [...s.speciesHistory, {
          t: now,
          species,
        }].slice(-MAX_HISTORY),

        speciesCatalog: catalog,
      }
    })
  },

  recordTradeResult: (species, regimeId, returnPct) => {
    set((s) => {
      let catalog = ensureCatalogEntry(s.speciesCatalog, species)
      catalog = catalog.map((e) => {
        if (e.id !== species) return e
        const rr = { ...e.regimeReturns }
        const existing = rr[regimeId] ?? { sum: 0, count: 0 }
        rr[regimeId] = { sum: existing.sum + returnPct, count: existing.count + 1 }
        return {
          ...e,
          totalReturn: e.totalReturn + returnPct,
          wins: returnPct > 0 ? e.wins + 1 : e.wins,
          regimeReturns: rr,
        }
      })
      return { speciesCatalog: catalog }
    })
  },

  reset: () => {
    set({
      curvatureProfile: [], torsionProfile: [],
      bettiH0: [], bettiH1: [], bettiThresholds: [],
      fourierDescriptors: [], curvatureSignature: [],
      currentSpecies: -1,
      curvatureHistory: [], torsionHistory: [], speciesHistory: [],
      speciesCatalog: [],
    })
  },
}))
