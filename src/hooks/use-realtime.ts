import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoherenceHistoryStore } from '@/stores/coherence-history.store'
import { usePriceSeriesStore } from '@/stores/price-series.store'
import { useDspTicksStore } from '@/stores/dsp-ticks.store'
import { usePolarRoseStore } from '@/stores/polar-rose.store'
import { useVoxelStore } from '@/stores/voxel.store'
import { usePortfolioStore } from '@/stores/portfolio.store'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useRealtimeSubscriptions() {
  const channelRef = useRef<RealtimeChannel | null>(null)

  const pushCoherence = useCoherenceHistoryStore((s) => s.push)
  const loadCoherence = useCoherenceHistoryStore((s) => s.load)
  const coherenceLoaded = useCoherenceHistoryStore((s) => s.loaded)
  const pushPriceTick = usePriceSeriesStore((s) => s.push)
  const loadPriceSeries = usePriceSeriesStore((s) => s.load)
  const pushDspTick = useDspTicksStore((s) => s.push)
  const loadDspTicks = useDspTicksStore((s) => s.load)
  const pushPolarRose = usePolarRoseStore((s) => s.push)
  const loadPolarRose = usePolarRoseStore((s) => s.load)
  const pushVoxel = useVoxelStore((s) => s.push)
  const loadVoxel = useVoxelStore((s) => s.load)
  const updatePortfolio = usePortfolioStore((s) => s.updateFromWorker)

  useEffect(() => {
    let cancelled = false

    async function seedStores() {
      const [coherenceRes, priceRes, dspRes, polarRes, voxelRes, portfolioRes, tradesRes] = await Promise.all([
        supabase.from('coherence_history').select('*').order('timestamp', { ascending: true }).limit(2000),
        supabase.from('price_series').select('*').order('timestamp', { ascending: true }).limit(2000),
        supabase.from('dsp_ticks').select('*').order('timestamp', { ascending: true }).limit(500),
        supabase.from('polar_rose').select('*').order('timestamp', { ascending: true }).limit(3000),
        supabase.from('voxel_snapshots').select('*').order('timestamp', { ascending: false }).limit(1),
        supabase.from('portfolio').select('*').eq('id', 'current').maybeSingle(),
        supabase.from('trades').select('*').order('timestamp', { ascending: true }),
      ])
      if (cancelled) return

      if (coherenceRes.data && !coherenceLoaded) {
        loadCoherence(coherenceRes.data.map((r) => ({
          id: r.id, timestamp: r.timestamp, rBar: r.r_bar, kappa: r.kappa,
          recurrenceRate: r.recurrence_rate ?? undefined, structureScore: r.structure_score ?? undefined,
          tDom: r.t_dom ?? undefined,
        })))
      }

      if (priceRes.data) {
        loadPriceSeries(priceRes.data.map((r) => ({
          timestamp: r.timestamp, price: r.price, logReturn: r.log_return, denoisedReturn: r.denoised_return,
        })))
      }

      if (dspRes.data) {
        loadDspTicks(dspRes.data.map(mapDspRow))
      }

      if (polarRes.data) {
        loadPolarRose(polarRes.data.map((r) => ({
          timestamp: r.timestamp, phase: r.phase, kappa: r.kappa, regimeId: r.regime_id,
        })))
      }

      if (voxelRes.data && voxelRes.data.length > 0) {
        const r = voxelRes.data[0]!
        loadVoxel({
          timestamp: r.timestamp,
          embeddingVecs: r.embedding_vecs as number[][] | undefined,
          recurrenceSize: r.recurrence_size ?? undefined,
          recurrenceRate: r.recurrence_rate ?? undefined,
          corrDimEstimate: r.corr_dim_estimate ?? undefined,
          structureScore: r.structure_score ?? undefined,
        })
      }

      if (portfolioRes.data) {
        const p = portfolioRes.data
        const trades = (tradesRes.data ?? []).map((t) => ({
          regimeId: t.regime_id, direction: t.direction, pnl: t.pnl,
          returnPct: t.return_pct, reward: t.reward, bars: t.bars,
          reason: t.reason, exitPrice: t.exit_price, timestamp: t.timestamp,
          paramVector: t.param_vector, entryKappa: t.entry_kappa, entryRBar: t.entry_r_bar,
        }))
        updatePortfolio({
          equity: p.equity,
          position: null,
          trades: trades as never[],
          equityCurve: p.equity_curve as number[],
          currentRegimeId: null,
          reentryCooldowns: p.cooldowns as number[],
          returns: p.returns as number[],
          barCount: p.bar_count,
          gpStates: [],
        })
      }
    }

    seedStores().catch(() => {})

    const channel = supabase
      .channel('sbn-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coherence_history' }, (payload) => {
        const r = payload.new as Record<string, unknown>
        pushCoherence(
          r.r_bar as number, r.kappa as number,
          r.recurrence_rate as number | undefined, r.structure_score as number | undefined,
          r.t_dom as number | undefined,
        )
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'price_series' }, (payload) => {
        const r = payload.new as Record<string, unknown>
        pushPriceTick({
          timestamp: r.timestamp as number, price: r.price as number,
          logReturn: r.log_return as number, denoisedReturn: r.denoised_return as number,
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dsp_ticks' }, (payload) => {
        pushDspTick(mapDspRow(payload.new as Record<string, unknown>))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'polar_rose' }, (payload) => {
        const r = payload.new as Record<string, unknown>
        pushPolarRose({
          timestamp: r.timestamp as number, phase: r.phase as number,
          kappa: r.kappa as number, regimeId: r.regime_id as number,
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voxel_snapshots' }, (payload) => {
        const r = payload.new as Record<string, unknown>
        pushVoxel({
          timestamp: r.timestamp as number,
          embeddingVecs: r.embedding_vecs as number[][] | undefined,
          recurrenceSize: r.recurrence_size as number | undefined,
          recurrenceRate: r.recurrence_rate as number | undefined,
          corrDimEstimate: r.corr_dim_estimate as number | undefined,
          structureScore: r.structure_score as number | undefined,
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portfolio' }, (payload) => {
        const p = payload.new as Record<string, unknown>
        if (p.equity != null) {
          updatePortfolio({
            equity: p.equity as number,
            position: null,
            trades: [],
            equityCurve: p.equity_curve as number[],
            currentRegimeId: null,
            reentryCooldowns: p.cooldowns as number[],
            returns: p.returns as number[],
            barCount: p.bar_count as number,
            gpStates: [],
          })
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trades' }, (payload) => {
        const t = payload.new as Record<string, unknown>
        const trade = {
          regimeId: t.regime_id, direction: t.direction, pnl: t.pnl,
          returnPct: t.return_pct, reward: t.reward, bars: t.bars,
          reason: t.reason, exitPrice: t.exit_price, timestamp: t.timestamp,
          paramVector: t.param_vector, entryKappa: t.entry_kappa, entryRBar: t.entry_r_bar,
        }
        usePortfolioStore.setState((s) => ({ trades: [...s.trades, trade] as typeof s.trades }))
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      cancelled = true
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [])
}

function mapDspRow(r: Record<string, unknown>) {
  return {
    timestamp: r.timestamp as number,
    rawPhaseDeg: r.raw_phase_deg as number | undefined,
    rawRBar: r.raw_r_bar as number | undefined,
    rawCyclePosition: r.raw_cycle_position as number | undefined,
    rawDominantK: r.raw_dominant_k as number | undefined,
    rawMeanPhase: r.raw_mean_phase as number | undefined,
    smoothPhaseDeg: r.smooth_phase_deg as number | undefined,
    smoothRBar: r.smooth_r_bar as number | undefined,
    vmKappa: r.vm_kappa as number | undefined,
    vmMu: r.vm_mu as number | undefined,
    clockPosition: r.clock_position as number | undefined,
    clockVelocity: r.clock_velocity as number | undefined,
    hmmAlpha: r.hmm_alpha as number[] | undefined,
    hmmActiveState: r.hmm_active_state as number | undefined,
    tDom: r.t_dom as number | undefined,
    tDomFrac: r.t_dom_frac as number | undefined,
    goertzelDomK: r.goertzel_dom_k as number | undefined,
    goertzelConfidence: r.goertzel_confidence as number | undefined,
    tau: r.tau as number | undefined,
    embeddingDim: r.embedding_dim as number | undefined,
    embedSpan: r.embed_span as number | undefined,
    phaseWindow: r.phase_window as number | undefined,
    vmHorizon: r.vm_horizon as number | undefined,
    vmLambda: r.vm_lambda as number | undefined,
    hmmDwell: r.hmm_dwell as number | undefined,
    hmmPSelf: r.hmm_p_self as number | undefined,
    barCount: r.bar_count as number | undefined,
    recurrenceRate: r.recurrence_rate as number | undefined,
    corrDimEstimate: r.corr_dim_estimate as number | undefined,
    structureScore: r.structure_score as number | undefined,
    rawFrequencies: r.raw_frequencies as unknown[] | undefined,
    goertzelSpectrum: r.goertzel_spectrum as unknown[] | undefined,
    trail: r.trail as number[] | undefined,
  }
}
