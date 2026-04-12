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
  corrDimEstimate?: number
  structureScore?: number
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
    structure_score: p.structureScore ?? null,
    t_dom: p.tDom ?? null,
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
    .order('timestamp', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    rBar: row.r_bar,
    kappa: row.kappa,
    recurrenceRate: row.recurrence_rate ?? undefined,
    structureScore: row.structure_score ?? undefined,
    tDom: row.t_dom ?? undefined,
  }))
}

// ---------------------------------------------------------------------------
// Price Series
// ---------------------------------------------------------------------------

const MAX_PRICE_TICKS = 10_000

export async function appendPriceTicks(ticks: PriceTick[]): Promise<void> {
  const rows = ticks.map((t) => ({
    timestamp: t.timestamp,
    price: t.price,
    log_return: t.logReturn,
    denoised_return: t.denoisedReturn,
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

export async function appendDspTicks(ticks: DspTick[]): Promise<void> {
  const rows = ticks.map((t) => ({
    timestamp: t.timestamp,
    raw_phase_deg: t.rawPhaseDeg ?? null,
    raw_r_bar: t.rawRBar ?? null,
    raw_cycle_position: t.rawCyclePosition ?? null,
    raw_dominant_k: t.rawDominantK ?? null,
    raw_mean_phase: t.rawMeanPhase ?? null,
    smooth_phase_deg: t.smoothPhaseDeg ?? null,
    smooth_r_bar: t.smoothRBar ?? null,
    vm_kappa: t.vmKappa ?? null,
    vm_mu: t.vmMu ?? null,
    clock_position: t.clockPosition ?? null,
    clock_velocity: t.clockVelocity ?? null,
    hmm_alpha: t.hmmAlpha ?? null,
    hmm_active_state: t.hmmActiveState ?? null,
    t_dom: t.tDom ?? null,
    t_dom_frac: t.tDomFrac ?? null,
    goertzel_dom_k: t.goertzelDomK ?? null,
    goertzel_confidence: t.goertzelConfidence ?? null,
    tau: t.tau ?? null,
    embedding_dim: t.embeddingDim ?? null,
    embed_span: t.embedSpan ?? null,
    phase_window: t.phaseWindow ?? null,
    vm_horizon: t.vmHorizon ?? null,
    vm_lambda: t.vmLambda ?? null,
    hmm_dwell: t.hmmDwell ?? null,
    hmm_p_self: t.hmmPSelf ?? null,
    bar_count: t.barCount ?? null,
    recurrence_rate: t.recurrenceRate ?? null,
    corr_dim_estimate: t.corrDimEstimate ?? null,
    structure_score: t.structureScore ?? null,
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
    phase: p.phase,
    kappa: p.kappa,
    regime_id: p.regimeId,
  }))
  const { error } = await supabase.from('polar_rose').insert(rows)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Voxel Snapshots
// ---------------------------------------------------------------------------

export async function appendVoxelSnapshots(snapshots: VoxelSnapshot[]): Promise<void> {
  const rows = snapshots.map((s) => ({
    timestamp: s.timestamp,
    embedding_vecs: s.embeddingVecs ?? null,
    recurrence_size: s.recurrenceSize ?? null,
    recurrence_rate: s.recurrenceRate ?? null,
    corr_dim_estimate: s.corrDimEstimate ?? null,
    structure_score: s.structureScore ?? null,
  }))
  const { error } = await supabase.from('voxel_snapshots').insert(rows)
  if (error) throw error
}
