import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoherenceHistoryStore } from '@/stores/coherence-history.store'
import { usePriceSeriesStore } from '@/stores/price-series.store'
import { useDspTicksStore } from '@/stores/dsp-ticks.store'
import { usePolarRoseStore } from '@/stores/polar-rose.store'
import { useVoxelStore } from '@/stores/voxel.store'
import { usePortfolioStore } from '@/stores/portfolio.store'
import { useTopologyStore } from '@/stores/topology.store'
import { useMorphologyStore } from '@/stores/morphology.store'
import { computeShapeMetrics } from '@/core/dsp/shape-metrics'
import { loadMorphologyHistory, loadSpeciesCatalog } from '@/services/persistence/db'

/**
 * Seed stores from persisted DB data on mount.
 *
 * Live data flows exclusively through the DSP worker → stores path.
 * We intentionally do NOT subscribe to Supabase Realtime INSERT events
 * because the worker already pushes each data point to stores immediately;
 * a realtime subscription would duplicate every point when the 10-second
 * DB flush fires, causing batch re-renders (visible as chart flickering).
 */
export function useRealtimeSubscriptions() {
  const loadCoherence = useCoherenceHistoryStore((s) => s.load)
  const coherenceLoaded = useCoherenceHistoryStore((s) => s.loaded)
  const loadPriceSeries = usePriceSeriesStore((s) => s.load)
  const loadDspTicks = useDspTicksStore((s) => s.load)
  const loadPolarRose = usePolarRoseStore((s) => s.load)
  const loadVoxel = useVoxelStore((s) => s.load)
  const updatePortfolio = usePortfolioStore((s) => s.updateFromWorker)
  const loadTopology = useTopologyStore((s) => s.load)
  const topologyLoaded = useTopologyStore((s) => s.loaded)
  const loadShapes = useTopologyStore((s) => s.loadShapes)
  const loadMorphHistory = useMorphologyStore((s) => s.loadHistory)
  const loadMorphCatalog = useMorphologyStore((s) => s.loadCatalog)

  useEffect(() => {
    let cancelled = false

    async function seedStores() {
      const [coherenceRes, priceRes, dspRes, polarRes, voxelRes, portfolioRes, tradesRes, topologyRes, shapeVoxelRes] = await Promise.all([
        supabase.from('coherence_history').select('*').order('timestamp', { ascending: false }).limit(2000),
        supabase.from('price_series').select('*').order('timestamp', { ascending: false }).limit(2000),
        supabase.from('dsp_ticks').select('*').order('timestamp', { ascending: false }).limit(500),
        supabase.from('polar_rose').select('*').order('timestamp', { ascending: false }).limit(3000),
        supabase.from('voxel_snapshots').select('*').order('timestamp', { ascending: false }).limit(1),
        supabase.from('portfolio').select('*').eq('id', 'current').maybeSingle(),
        supabase.from('trades').select('*').order('timestamp', { ascending: true }),
        supabase.from('topology_snapshots').select('*').order('timestamp', { ascending: false }).limit(500),
        supabase.from('voxel_snapshots').select('timestamp,embedding_vecs').not('embedding_vecs', 'is', null).order('timestamp', { ascending: false }).limit(30),
      ])
      if (cancelled) return

      if (coherenceRes.data && !coherenceLoaded) {
        loadCoherence(coherenceRes.data.reverse().map((r) => ({
          id: r.id, timestamp: r.timestamp, rBar: r.r_bar, kappa: r.kappa,
          recurrenceRate: r.recurrence_rate ?? undefined,
          fixedRecurrenceRate: r.fixed_recurrence_rate ?? undefined,
          structureScore: r.structure_score ?? undefined,
          tDom: r.t_dom ?? undefined,
          windingNumber: r.winding_number ?? undefined,
          topologyScore: r.topology_score ?? undefined,
          topologyClass: r.topology_class ?? undefined,
          ppc: r.ppc ?? undefined,
          hurst: r.hurst ?? undefined,
        })))
      }

      if (priceRes.data) {
        loadPriceSeries(priceRes.data.reverse().map((r) => ({
          timestamp: r.timestamp, price: r.price, logReturn: r.log_return, denoisedReturn: r.denoised_return,
        })))
      }

      if (dspRes.data) {
        loadDspTicks(dspRes.data.reverse().map(mapDspRow))
      }

      if (polarRes.data) {
        loadPolarRose(polarRes.data.reverse().map((r) => ({
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
          fixedRecurrenceRate: r.fixed_recurrence_rate ?? undefined,
          corrDimEstimate: r.corr_dim_estimate ?? undefined,
          structureScore: r.structure_score ?? undefined,
        })
      }

      if (topologyRes.data && !topologyLoaded) {
        loadTopology(topologyRes.data.reverse().map((r: Record<string, unknown>) => ({
          id: r.id as number,
          timestamp: r.timestamp as number,
          windingNumber: r.winding_number as number,
          absWinding: r.abs_winding as number,
          circulation: r.circulation as number,
          loopClosure: r.loop_closure as number,
          corrDim: (r.corr_dim as number) ?? 0,
          recurrenceRate: (r.recurrence_rate as number) ?? 0,
          structureScore: (r.structure_score as number) ?? 0,
          topologyClass: r.topology_class as string,
          topologyScore: r.topology_score as number,
          kappa: (r.kappa as number) ?? 0,
          fingerprintVector: (r.fingerprint_vector as number[]) ?? [],
        })))
      }

      if (shapeVoxelRes.data && shapeVoxelRes.data.length > 0) {
        const shapes = shapeVoxelRes.data
          .reverse()
          .map((r) => {
            const vecs = r.embedding_vecs as number[][] | null
            if (!vecs || vecs.length < 4) return null
            return computeShapeMetrics(vecs, r.timestamp as number)
          })
          .filter((s): s is NonNullable<typeof s> => s !== null)
        if (shapes.length > 0) loadShapes(shapes)
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

      try {
        const [morphRows, catalogRows] = await Promise.all([
          loadMorphologyHistory(500),
          loadSpeciesCatalog(),
        ])
        if (cancelled) return
        if (morphRows.length > 0) {
          loadMorphHistory(
            morphRows.map((r) => ({ t: r.timestamp, mean: r.mean_curvature, max: r.max_curvature, concentration: r.curvature_concentration })),
            morphRows.map((r) => ({ t: r.timestamp, energy: r.torsion_energy })),
            morphRows.map((r) => ({ t: r.timestamp, species: r.species, regimeId: r.regime_id })),
          )
        }
        if (catalogRows.length > 0) {
          loadMorphCatalog(catalogRows.map((r) => ({
            id: r.id,
            count: r.count,
            totalReturn: r.total_return,
            wins: r.wins,
            avgCurvatureConcentration: r.avg_curvature_concentration,
            avgH1Peak: r.avg_h1_peak,
            lastSeen: r.last_seen,
            regimeReturns: r.regime_returns,
          })))
        }
      } catch (err) {
        console.error('[sbn] morphology seed failed:', err)
      }
    }

    seedStores().catch((err) => console.error('[sbn] seedStores failed:', err))

    return () => {
      cancelled = true
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
