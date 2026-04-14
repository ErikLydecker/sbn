import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/supabase'

export const PERSISTENCE_VERSION = 3

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

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
  tDomEma?: number
  tDomAccepted?: number
  tDomCandidate?: number
  tDomDwellCount?: number
  frozenTau?: number
  frozenDim?: number
  eventBars?: number[]
  eventTimestamps?: number[]
  lastClosePrice?: number
  phaseBasisE1?: number[]
  phaseBasisE2?: number[]
  goertzelSnapshot?: {
    re: number[]
    im: number[]
    persistence: number[]
    phase: number
    sampleCount: number
  } | null
  topologyState?: {
    windingHistory: number[]
    circulationHistory: number[]
    closureHistory: number[]
    fingerprintHistory: unknown[]
  } | null
}

export interface CoherencePoint {
  id?: number
  timestamp: number
  rBar: number
  kappa: number
  recurrenceRate?: number
  fixedRecurrenceRate?: number
  structureScore?: number
  tDom?: number
  windingNumber?: number
  topologyScore?: number
  topologyClass?: string
  ppc?: number
  hurst?: number
}

export interface PriceTick {
  timestamp: number
  price: number
  logReturn: number
  denoisedReturn: number
}

export interface DspTick {
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
}

export interface PolarRosePoint {
  timestamp: number
  phase: number
  kappa: number
  regimeId: number
}

export interface VoxelSnapshot {
  timestamp: number
  embeddingVecs?: number[][]
  recurrenceSize?: number
  recurrenceRate?: number
  fixedRecurrenceRate?: number
  corrDimEstimate?: number
  structureScore?: number
}

// ---------------------------------------------------------------------------
// GP States
// ---------------------------------------------------------------------------

export async function saveGpStates(
  gps: { X: number[][]; y: number[]; Kinv: number[][] | null }[],
): Promise<void> {
  const rows = gps.map((gp, i) => ({
    regime_id: i,
    inputs: gp.X,
    outputs: gp.y,
    kernel_inverse: gp.Kinv,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('gp_states').upsert(rows, { onConflict: 'regime_id' })
  if (error) throw error
}

export async function loadGpStates(): Promise<PersistedGpState[] | null> {
  const { data, error } = await supabase
    .from('gp_states')
    .select('*')
    .order('regime_id', { ascending: true })
  if (error) throw error
  if (!data || data.length !== 8) return null
  return data.map((row) => ({
    regimeId: row.regime_id,
    inputs: row.inputs as number[][],
    outputs: row.outputs as number[],
    kernelInverse: row.kernel_inverse as number[][] | null,
  }))
}

// ---------------------------------------------------------------------------
// Portfolio (trades are now append-only)
// ---------------------------------------------------------------------------

let lastPersistedTradeCount = 0

export async function savePortfolio(data: Omit<PersistedPortfolio, 'id' | 'version' | 'savedAt'>): Promise<void> {
  const { error: portfolioError } = await supabase.from('portfolio').upsert({
    id: 'current',
    version: PERSISTENCE_VERSION,
    equity: data.equity,
    initial_equity: data.initialEquity,
    equity_curve: data.equityCurve,
    cooldowns: data.cooldowns,
    returns: data.returns,
    bar_count: data.barCount,
    saved_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (portfolioError) throw portfolioError

  const allTrades = data.trades as Record<string, unknown>[]
  const newTrades = allTrades.slice(lastPersistedTradeCount)
  if (newTrades.length > 0) {
    const tradeRows = newTrades.map((t) => ({
      regime_id: t.regimeId as number,
      direction: t.direction as number,
      pnl: t.pnl as number,
      return_pct: t.returnPct as number,
      reward: t.reward as number,
      bars: t.bars as number,
      reason: t.reason as string,
      exit_price: t.exitPrice as number,
      timestamp: t.timestamp as number,
      param_vector: t.paramVector as number[],
      entry_kappa: (t.entryKappa as number) ?? null,
      entry_r_bar: (t.entryRBar as number) ?? null,
    }))
    const { error: tradesError } = await supabase.from('trades').insert(tradeRows)
    if (tradesError) throw tradesError
  }
  lastPersistedTradeCount = allTrades.length
}

export async function loadPortfolio(): Promise<PersistedPortfolio | null> {
  const { data: row, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('id', 'current')
    .maybeSingle()
  if (error) throw error
  if (!row) return null

  const { data: tradeRows, error: tradesError } = await supabase
    .from('trades')
    .select('*')
    .order('timestamp', { ascending: true })
  if (tradesError) throw tradesError

  const trades = (tradeRows ?? []).map((t) => ({
    regimeId: t.regime_id,
    direction: t.direction,
    pnl: t.pnl,
    returnPct: t.return_pct,
    reward: t.reward,
    bars: t.bars,
    reason: t.reason,
    exitPrice: t.exit_price,
    timestamp: t.timestamp,
    paramVector: t.param_vector,
    entryKappa: t.entry_kappa,
    entryRBar: t.entry_r_bar,
  }))

  lastPersistedTradeCount = trades.length

  return {
    id: 'current',
    version: row.version,
    equity: row.equity,
    initialEquity: row.initial_equity,
    trades,
    equityCurve: row.equity_curve as number[],
    cooldowns: row.cooldowns as number[],
    returns: row.returns as number[],
    barCount: row.bar_count,
    savedAt: new Date(row.saved_at).getTime(),
  }
}

// ---------------------------------------------------------------------------
// Smooth State
// ---------------------------------------------------------------------------

export async function saveSmoothState(state: Omit<PersistedSmoothState, 'id'>): Promise<void> {
  const { error } = await supabase.from('smooth_state').upsert({
    id: 'current',
    vm_mu: state.vmMu,
    vm_kappa: state.vmKappa,
    alpha: state.alpha,
    clock_pos: state.clockPos,
    vel: state.vel,
    trail: state.trail,
    tau: state.tau,
    dim: state.dim,
    t_dom: state.tDom,
    hmm_a: state.hmmA,
    hmm_tdom_a: state.hmmTdomA,
    last_tdom: state.lastTdom,
    phase_kappa_history: state.phaseKappaHistory ?? [],
    last_regime_id: state.lastRegimeId ?? null,
    t_dom_ema: state.tDomEma ?? 40,
    t_dom_accepted: state.tDomAccepted ?? 40,
    t_dom_candidate: state.tDomCandidate ?? 40,
    t_dom_dwell_count: state.tDomDwellCount ?? 0,
    frozen_tau: state.frozenTau ?? 4,
    frozen_dim: state.frozenDim ?? 5,
    event_bars: state.eventBars ?? [],
    event_timestamps: state.eventTimestamps ?? [],
    last_close_price: state.lastClosePrice ?? 0,
    phase_basis_e1: state.phaseBasisE1 ?? [],
    phase_basis_e2: state.phaseBasisE2 ?? [],
    goertzel_snapshot: state.goertzelSnapshot ?? null,
    topology_state: (state.topologyState ?? null) as Json,
  }, { onConflict: 'id' })
  if (error) throw error
}

export async function loadSmoothState(): Promise<PersistedSmoothState | null> {
  const { data: row, error } = await supabase
    .from('smooth_state')
    .select('*')
    .eq('id', 'current')
    .maybeSingle()
  if (error) throw error
  if (!row) return null

  return {
    id: 'current',
    vmMu: row.vm_mu,
    vmKappa: row.vm_kappa,
    alpha: row.alpha as [number, number, number, number],
    clockPos: row.clock_pos,
    vel: row.vel,
    trail: row.trail as number[],
    tau: row.tau,
    dim: row.dim,
    tDom: row.t_dom,
    hmmA: row.hmm_a as number[][] | null,
    hmmTdomA: row.hmm_tdom_a,
    lastTdom: row.last_tdom,
    phaseKappaHistory: row.phase_kappa_history as { phase: number; kappa: number; regimeId: number }[],
    lastRegimeId: row.last_regime_id ?? undefined,
    tDomEma: row.t_dom_ema ?? undefined,
    tDomAccepted: row.t_dom_accepted ?? undefined,
    tDomCandidate: row.t_dom_candidate ?? undefined,
    tDomDwellCount: row.t_dom_dwell_count ?? undefined,
    frozenTau: row.frozen_tau ?? undefined,
    frozenDim: row.frozen_dim ?? undefined,
    eventBars: (row.event_bars as number[] | null) ?? undefined,
    eventTimestamps: (row.event_timestamps as number[] | null) ?? undefined,
    lastClosePrice: row.last_close_price ?? undefined,
    phaseBasisE1: (row.phase_basis_e1 as number[] | null) ?? undefined,
    phaseBasisE2: (row.phase_basis_e2 as number[] | null) ?? undefined,
    goertzelSnapshot: row.goertzel_snapshot as PersistedSmoothState['goertzelSnapshot'] ?? undefined,
    topologyState: (row as Record<string, unknown>).topology_state as PersistedSmoothState['topologyState'] ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

export async function clearPersistedState(): Promise<void> {
  await Promise.all([
    supabase.from('gp_states').delete().gte('regime_id', 0),
    supabase.from('portfolio').delete().eq('id', 'current'),
    supabase.from('trades').delete().gte('id', 0),
    supabase.from('smooth_state').delete().eq('id', 'current'),
  ])
  lastPersistedTradeCount = 0
}

// ---------------------------------------------------------------------------
// Coherence History
// ---------------------------------------------------------------------------

const MAX_COHERENCE_POINTS = 2000

export async function appendCoherencePoints(points: CoherencePoint[]): Promise<void> {
  const rows = points.map((p) => ({
    timestamp: p.timestamp,
    r_bar: p.rBar,
    kappa: p.kappa,
    recurrence_rate: p.recurrenceRate ?? null,
    fixed_recurrence_rate: p.fixedRecurrenceRate ?? null,
    structure_score: p.structureScore ?? null,
    t_dom: p.tDom ?? null,
    winding_number: p.windingNumber != null ? finOpt(p.windingNumber) : null,
    topology_score: p.topologyScore != null ? finOpt(p.topologyScore) : null,
    topology_class: p.topologyClass ?? null,
    ppc: p.ppc != null ? finOpt(p.ppc) : null,
    hurst: p.hurst != null ? finOpt(p.hurst) : null,
  }))
  const { error } = await supabase.from('coherence_history').insert(rows)
  if (error) throw error

  const { count, error: countError } = await supabase
    .from('coherence_history')
    .select('*', { count: 'exact', head: true })
  if (countError) throw countError

  if (count && count > MAX_COHERENCE_POINTS * 1.2) {
    const excess = count - MAX_COHERENCE_POINTS
    const { data: oldest, error: oldestError } = await supabase
      .from('coherence_history')
      .select('id')
      .order('timestamp', { ascending: true })
      .limit(excess)
    if (oldestError) throw oldestError
    if (oldest && oldest.length > 0) {
      const ids = oldest.map((r) => r.id)
      await supabase.from('coherence_history').delete().in('id', ids)
    }
  }
}

export async function loadCoherenceHistory(): Promise<CoherencePoint[]> {
  const { data, error } = await supabase
    .from('coherence_history')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(2000)
  if (error) throw error
  return (data ?? []).reverse().map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    rBar: row.r_bar,
    kappa: row.kappa,
    recurrenceRate: row.recurrence_rate ?? undefined,
    fixedRecurrenceRate: row.fixed_recurrence_rate ?? undefined,
    structureScore: row.structure_score ?? undefined,
    tDom: row.t_dom ?? undefined,
    windingNumber: row.winding_number ?? undefined,
    topologyScore: row.topology_score ?? undefined,
    topologyClass: row.topology_class ?? undefined,
    ppc: row.ppc ?? undefined,
    hurst: row.hurst ?? undefined,
  }))
}

// ---------------------------------------------------------------------------
// Price Series
// ---------------------------------------------------------------------------

const MAX_PRICE_TICKS = 10_000

function fin(v: number): number {
  return Number.isFinite(v) ? v : 0
}

export async function appendPriceTicks(ticks: PriceTick[]): Promise<void> {
  const rows = ticks.map((t) => ({
    timestamp: t.timestamp,
    price: fin(t.price),
    log_return: fin(t.logReturn),
    denoised_return: fin(t.denoisedReturn),
  }))
  const { error } = await supabase.from('price_series').insert(rows)
  if (error) throw error

  const { count, error: countError } = await supabase
    .from('price_series')
    .select('*', { count: 'exact', head: true })
  if (countError) throw countError

  if (count && count > MAX_PRICE_TICKS * 1.2) {
    const excess = count - MAX_PRICE_TICKS
    const { data: oldest, error: oldestError } = await supabase
      .from('price_series')
      .select('id')
      .order('timestamp', { ascending: true })
      .limit(excess)
    if (oldestError) throw oldestError
    if (oldest && oldest.length > 0) {
      const ids = oldest.map((r) => r.id)
      await supabase.from('price_series').delete().in('id', ids)
    }
  }
}

// ---------------------------------------------------------------------------
// DSP Ticks
// ---------------------------------------------------------------------------

function finOpt(v: number | undefined): number | null {
  if (v == null) return null
  return Number.isFinite(v) ? v : 0
}

export async function appendDspTicks(ticks: DspTick[]): Promise<void> {
  const rows = ticks.map((t) => ({
    timestamp: t.timestamp,
    raw_phase_deg: finOpt(t.rawPhaseDeg),
    raw_r_bar: finOpt(t.rawRBar),
    raw_cycle_position: finOpt(t.rawCyclePosition),
    raw_dominant_k: finOpt(t.rawDominantK),
    raw_mean_phase: finOpt(t.rawMeanPhase),
    smooth_phase_deg: finOpt(t.smoothPhaseDeg),
    smooth_r_bar: finOpt(t.smoothRBar),
    vm_kappa: finOpt(t.vmKappa),
    vm_mu: finOpt(t.vmMu),
    clock_position: finOpt(t.clockPosition),
    clock_velocity: finOpt(t.clockVelocity),
    hmm_alpha: t.hmmAlpha ?? null,
    hmm_active_state: t.hmmActiveState ?? null,
    t_dom: finOpt(t.tDom),
    t_dom_frac: finOpt(t.tDomFrac),
    goertzel_dom_k: finOpt(t.goertzelDomK),
    goertzel_confidence: finOpt(t.goertzelConfidence),
    tau: finOpt(t.tau),
    embedding_dim: finOpt(t.embeddingDim),
    embed_span: finOpt(t.embedSpan),
    phase_window: finOpt(t.phaseWindow),
    vm_horizon: finOpt(t.vmHorizon),
    vm_lambda: finOpt(t.vmLambda),
    hmm_dwell: finOpt(t.hmmDwell),
    hmm_p_self: finOpt(t.hmmPSelf),
    bar_count: t.barCount ?? null,
    recurrence_rate: finOpt(t.recurrenceRate),
    fixed_recurrence_rate: finOpt(t.fixedRecurrenceRate),
    corr_dim_estimate: finOpt(t.corrDimEstimate),
    structure_score: finOpt(t.structureScore),
    raw_frequencies: (t.rawFrequencies as Json[] | undefined) ?? null,
    goertzel_spectrum: (t.goertzelSpectrum as Json[] | undefined) ?? null,
    trail: (t.trail as Json | undefined) ?? null,
  }))
  const { error } = await supabase.from('dsp_ticks').insert(rows)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Polar Rose
// ---------------------------------------------------------------------------

export async function appendPolarRosePoints(points: PolarRosePoint[]): Promise<void> {
  const rows = points.map((p) => ({
    timestamp: p.timestamp,
    phase: fin(p.phase),
    kappa: fin(p.kappa),
    regime_id: p.regimeId,
  }))
  const { error } = await supabase.from('polar_rose').insert(rows)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Voxel Snapshots
// ---------------------------------------------------------------------------

const MAX_DSP_TICKS = 10_000
const MAX_POLAR_ROSE = 10_000
const MAX_VOXEL_SNAPSHOTS = 5_000

type PrunableTable = 'dsp_ticks' | 'polar_rose' | 'voxel_snapshots' | 'topology_snapshots' | 'morphology_history'

async function pruneTable(table: PrunableTable, max: number): Promise<void> {
  const { count, error: countError } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
  if (countError || !count || count <= max * 1.2) return
  const excess = count - max
  const { data: oldest, error: oldestError } = await supabase
    .from(table)
    .select('id, timestamp')
    .order('timestamp', { ascending: true })
    .limit(excess)
  if (oldestError || !oldest || oldest.length === 0) return
  const ids = oldest.map((r) => r.id)
  await supabase.from(table).delete().in('id', ids)
}

export async function pruneTables(): Promise<void> {
  await Promise.all([
    pruneTable('dsp_ticks', MAX_DSP_TICKS),
    pruneTable('polar_rose', MAX_POLAR_ROSE),
    pruneTable('voxel_snapshots', MAX_VOXEL_SNAPSHOTS),
    pruneTable('topology_snapshots', MAX_TOPOLOGY_SNAPSHOTS),
    pruneTable('morphology_history', MAX_MORPHOLOGY_HISTORY),
  ])
}

// ---------------------------------------------------------------------------
// Topology Snapshots
// ---------------------------------------------------------------------------

export interface TopologySnapshotRow {
  id?: number
  timestamp: number
  windingNumber: number
  absWinding: number
  circulation: number
  loopClosure: number
  corrDim: number
  recurrenceRate: number
  structureScore: number
  topologyClass: string
  topologyScore: number
  kappa: number
  fingerprintVector: number[]
}

const MAX_TOPOLOGY_SNAPSHOTS = 5_000

export async function appendTopologySnapshots(snapshots: TopologySnapshotRow[]): Promise<void> {
  const rows = snapshots.map((s) => ({
    timestamp: s.timestamp,
    winding_number: fin(s.windingNumber),
    abs_winding: fin(s.absWinding),
    circulation: fin(s.circulation),
    loop_closure: fin(s.loopClosure),
    corr_dim: finOpt(s.corrDim),
    recurrence_rate: finOpt(s.recurrenceRate),
    structure_score: finOpt(s.structureScore),
    topology_class: s.topologyClass,
    topology_score: fin(s.topologyScore),
    kappa: finOpt(s.kappa),
    fingerprint_vector: s.fingerprintVector,
  }))
  const { error } = await supabase.from('topology_snapshots').insert(rows)
  if (error) throw error
}

export async function loadTopologySnapshots(limit = 500): Promise<TopologySnapshotRow[]> {
  const { data, error } = await supabase
    .from('topology_snapshots')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    windingNumber: row.winding_number,
    absWinding: row.abs_winding,
    circulation: row.circulation,
    loopClosure: row.loop_closure,
    corrDim: row.corr_dim ?? 0,
    recurrenceRate: row.recurrence_rate ?? 0,
    structureScore: row.structure_score ?? 0,
    topologyClass: row.topology_class,
    topologyScore: row.topology_score,
    kappa: row.kappa ?? 0,
    fingerprintVector: row.fingerprint_vector as number[],
  })).reverse()
}

export async function appendVoxelSnapshots(snapshots: VoxelSnapshot[]): Promise<void> {
  const rows = snapshots.map((s) => ({
    timestamp: s.timestamp,
    embedding_vecs: s.embeddingVecs ?? null,
    recurrence_size: s.recurrenceSize ?? null,
    recurrence_rate: finOpt(s.recurrenceRate),
    fixed_recurrence_rate: finOpt(s.fixedRecurrenceRate),
    corr_dim_estimate: finOpt(s.corrDimEstimate),
    structure_score: finOpt(s.structureScore),
  }))
  const { error } = await supabase.from('voxel_snapshots').insert(rows)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Morphology History
// ---------------------------------------------------------------------------

export interface MorphologyHistoryRow {
  timestamp: number
  mean_curvature: number
  max_curvature: number
  curvature_concentration: number
  torsion_energy: number
  species: number
  regime_id?: number
}

const MAX_MORPHOLOGY_HISTORY = 5_000

export async function appendMorphologyHistory(rows: MorphologyHistoryRow[]): Promise<void> {
  const mapped = rows.map((r) => ({
    timestamp: r.timestamp,
    mean_curvature: fin(r.mean_curvature),
    max_curvature: fin(r.max_curvature),
    curvature_concentration: fin(r.curvature_concentration),
    torsion_energy: fin(r.torsion_energy),
    species: r.species,
    regime_id: r.regime_id ?? null,
  }))
  const { error } = await supabase.from('morphology_history').insert(mapped)
  if (error) throw error
}

export async function loadMorphologyHistory(limit = 500): Promise<MorphologyHistoryRow[]> {
  const { data, error } = await supabase
    .from('morphology_history')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => ({
    timestamp: r.timestamp,
    mean_curvature: r.mean_curvature,
    max_curvature: r.max_curvature,
    curvature_concentration: r.curvature_concentration,
    torsion_energy: r.torsion_energy,
    species: r.species,
    regime_id: r.regime_id ?? undefined,
  })).reverse()
}

// ---------------------------------------------------------------------------
// Species Catalog
// ---------------------------------------------------------------------------

export interface SpeciesCatalogRow {
  id: number
  count: number
  total_return: number
  wins: number
  avg_curvature_concentration: number
  avg_h1_peak: number
  last_seen: number
  regime_returns: Record<number, { sum: number; count: number }>
}

export async function upsertSpeciesCatalog(entries: SpeciesCatalogRow[]): Promise<void> {
  if (entries.length === 0) return
  const rows = entries.map((e) => ({
    id: e.id,
    count: e.count,
    total_return: fin(e.total_return),
    wins: e.wins,
    avg_curvature_concentration: fin(e.avg_curvature_concentration),
    avg_h1_peak: fin(e.avg_h1_peak),
    last_seen: e.last_seen,
    regime_returns: e.regime_returns,
  }))
  const { error } = await supabase.from('species_catalog').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

export async function loadSpeciesCatalog(): Promise<SpeciesCatalogRow[]> {
  const { data, error } = await supabase
    .from('species_catalog')
    .select('*')
    .order('id', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    count: r.count,
    total_return: r.total_return,
    wins: r.wins,
    avg_curvature_concentration: r.avg_curvature_concentration,
    avg_h1_peak: r.avg_h1_peak,
    last_seen: r.last_seen,
    regime_returns: (r.regime_returns as Record<number, { sum: number; count: number }>) ?? {},
  }))
}
