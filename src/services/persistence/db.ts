import Dexie, { type EntityTable } from 'dexie'

export const PERSISTENCE_VERSION = 3

export interface PersistedGpState {
  regimeId: number
  inputs: number[][]
  outputs: number[]
  kernelInverse: number[][] | null
}

export interface PersistedPortfolio {
  id: 'current'
  version: number
  equity: number
  initialEquity: number
  trades: unknown[]
  equityCurve: number[]
  cooldowns: number[]
  returns: number[]
  barCount: number
  savedAt: number
}

export interface PersistedSmoothState {
  id: 'current'
  vmMu: number
  vmKappa: number
  alpha: [number, number, number, number]
  clockPos: number
  vel: number
  trail: number[]
  tau: number
  dim: number
  tDom: number
  hmmA: number[][] | null
  hmmTdomA: number
  lastTdom: number
  phaseKappaHistory?: { phase: number; kappa: number; regimeId: number }[]
  lastRegimeId?: number
}

export interface CoherencePoint {
  id?: number
  timestamp: number
  rBar: number
  kappa: number
  recurrenceRate?: number
  structureScore?: number
  tDom?: number
}

class SbnDatabase extends Dexie {
  gpStates!: EntityTable<PersistedGpState, 'regimeId'>
  portfolio!: EntityTable<PersistedPortfolio, 'id'>
  smoothState!: EntityTable<PersistedSmoothState, 'id'>
  coherenceHistory!: EntityTable<CoherencePoint, 'id'>

  constructor() {
    super('sbn-trading')
    this.version(1).stores({
      gpStates: 'regimeId',
      portfolio: 'id',
    })
    this.version(2).stores({
      gpStates: 'regimeId',
      portfolio: 'id',
      smoothState: 'id',
    })
    this.version(3).stores({
      gpStates: 'regimeId',
      portfolio: 'id',
      smoothState: 'id',
      coherenceHistory: '++id, timestamp',
    })
  }
}

export const db = new SbnDatabase()

export async function saveGpStates(
  gps: { X: number[][]; y: number[]; Kinv: number[][] | null }[],
): Promise<void> {
  const rows: PersistedGpState[] = gps.map((gp, i) => ({
    regimeId: i,
    inputs: gp.X,
    outputs: gp.y,
    kernelInverse: gp.Kinv,
  }))
  await db.gpStates.bulkPut(rows)
}

export async function loadGpStates(): Promise<PersistedGpState[] | null> {
  const rows = await db.gpStates.toArray()
  if (rows.length !== 8) return null
  return rows.sort((a, b) => a.regimeId - b.regimeId)
}

export async function savePortfolio(data: Omit<PersistedPortfolio, 'id' | 'version' | 'savedAt'>): Promise<void> {
  await db.portfolio.put({ ...data, id: 'current', version: PERSISTENCE_VERSION, savedAt: Date.now() })
}

export async function loadPortfolio(): Promise<PersistedPortfolio | null> {
  return (await db.portfolio.get('current')) ?? null
}

export async function saveSmoothState(state: Omit<PersistedSmoothState, 'id'>): Promise<void> {
  await db.smoothState.put({ ...state, id: 'current' })
}

export async function loadSmoothState(): Promise<PersistedSmoothState | null> {
  return (await db.smoothState.get('current')) ?? null
}

export async function clearPersistedState(): Promise<void> {
  await Promise.all([db.gpStates.clear(), db.portfolio.clear(), db.smoothState.clear()])
}

const MAX_COHERENCE_POINTS = 2000

export async function appendCoherencePoints(points: CoherencePoint[]): Promise<void> {
  await db.coherenceHistory.bulkAdd(points)
  const count = await db.coherenceHistory.count()
  if (count > MAX_COHERENCE_POINTS * 1.2) {
    const excess = count - MAX_COHERENCE_POINTS
    const oldest = await db.coherenceHistory.orderBy('timestamp').limit(excess).primaryKeys()
    await db.coherenceHistory.bulkDelete(oldest)
  }
}

export async function loadCoherenceHistory(): Promise<CoherencePoint[]> {
  return db.coherenceHistory.orderBy('timestamp').toArray()
}
