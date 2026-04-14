import type { RawAnalysis, SmoothAnalysis } from '@/schemas/analysis'
import type { OpenPosition, ClosedTrade } from '@/schemas/trade'
import type { RegimeId } from '@/schemas/regime'
import type { GpState } from '@/schemas/portfolio'
import type { Timeframe } from '@/schemas/settings'
import type { OhlcBar } from '@/services/ohlc/aggregator'
import type { TopologyFingerprint, FingerprintMatch, TopologyClass } from '@/core/dsp/topology'

export type WorkerInbound =
  | { type: 'price'; price: number }
  | { type: 'settings'; rawWindow: number; manualK: number | null; timeframe: Timeframe }
  | { type: 'backfill'; bars: OhlcBar[] }
  | { type: 'reset' }

export interface GeometryWorkerData {
  history: { phase: number; kappa: number; regimeId: number }[]
  transitions: number[]
}

export interface PriceTickData {
  timestamp: number
  price: number
  logReturn: number
  denoisedReturn: number
}

export interface DspTickData {
  timestamp: number
  rawPhaseDeg?: number
  rawRBar?: number
  rawCyclePosition?: number
  rawDominantK?: number
  rawMeanPhase?: number
  smoothPhaseDeg?: number
  smoothRBar?: number
  vmKappa?: number
  vmMu?: number
  clockPosition?: number
  clockVelocity?: number
  hmmAlpha?: number[]
  hmmActiveState?: number
  tDom?: number
  tDomFrac?: number
  goertzelDomK?: number
  goertzelConfidence?: number
  tau?: number
  embeddingDim?: number
  embedSpan?: number
  phaseWindow?: number
  vmHorizon?: number
  vmLambda?: number
  hmmDwell?: number
  hmmPSelf?: number
  barCount?: number
  recurrenceRate?: number
  fixedRecurrenceRate?: number
  corrDimEstimate?: number
  structureScore?: number
  subspaceStability?: number
  rawFrequencies?: unknown[]
  goertzelSpectrum?: unknown[]
  trail?: number[]
  ppc?: number
  hurst?: number
}

export interface PolarRoseData {
  timestamp: number
  phase: number
  kappa: number
  regimeId: number
}

export interface VoxelSnapshotData {
  timestamp: number
  embeddingVecs?: number[][]
  recurrenceSize?: number
  recurrenceRate?: number
  fixedRecurrenceRate?: number
  corrDimEstimate?: number
  structureScore?: number
}

export interface TopologyWorkerData {
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
  morphologySpecies: number
  curvatureProfile?: number[]
  torsionProfile?: number[]
  meanCurvature: number
  maxCurvature: number
  curvatureVariance: number
  curvatureConcentration: number
  meanTorsion: number
  torsionEnergy: number
  h0Persistence: number
  h1Peak: number
  h1Persistence: number
  fragmentationRate: number
  bettiH0?: number[]
  bettiH1?: number[]
  bettiThresholds?: number[]
  fourierDescriptors?: number[]
  curvatureSignature?: number[]
}

export interface CrsSnapshotData {
  timestamp: number
  regimeId: number
  phase: number
  direction: 1 | -1
  clockVel: number
  clockAccel: number
  kappaPersistence: number
  kappa: number
  ppc: number
  hurst: number
  topologyScore: number
  topologyClass: string
  recurrenceRate: number
  structureScore: number
  curvatureConcentration: number
  h1Peak: number
  torsionEnergy: number
  subspaceStability: number
  alphaPhase: number
  coherenceGroup: number
  regimeGroup: number
  topologyGroup: number
  geometryGroup: number
  trendGroup: number
  composite: number
  threshold: number
  entered: boolean
  cooldownActive: boolean
  directionMatch: boolean
  accelMatch: boolean
  price: number
}

export interface BarTimingData {
  lastBarTime: number
  intervalMs: number
}

export type WorkerOutbound =
  | { type: 'raw'; data: RawAnalysis }
  | { type: 'smooth'; data: SmoothAnalysis }
  | { type: 'portfolio'; data: PortfolioWorkerData }
  | { type: 'geometry'; data: GeometryWorkerData }
  | { type: 'priceTick'; data: PriceTickData }
  | { type: 'dspTick'; data: DspTickData }
  | { type: 'polarRose'; data: PolarRoseData }
  | { type: 'voxelSnapshot'; data: VoxelSnapshotData }
  | { type: 'topology'; data: TopologyWorkerData }
  | { type: 'crsSnapshot'; data: CrsSnapshotData }
  | { type: 'barCount'; count: number }
  | { type: 'candles'; bars: OhlcBar[] }
  | { type: 'barTiming'; data: BarTimingData }

export interface PortfolioWorkerData {
  equity: number
  position: OpenPosition | null
  trades: ClosedTrade[]
  equityCurve: number[]
  currentRegimeId: RegimeId | null
  reentryCooldowns: number[]
  returns: number[]
  barCount: number
  gpStates: GpState[]
}
