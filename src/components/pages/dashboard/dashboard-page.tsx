import { memo } from 'react'
import { HmmStateBanner } from '@/components/panels/hmm-state-banner'
import { PriceChart } from '@/components/charts/price-chart'
import { PhaseClock } from '@/components/charts/phase-clock'
import { SpectrumChart } from '@/components/charts/spectrum-chart'
import { CoherenceHistoryChart } from '@/components/charts/coherence-history-chart'
import { HurstHistoryChart } from '@/components/charts/hurst-history-chart'
import { PpcHistoryChart } from '@/components/charts/ppc-history-chart'
import { CoherenceScatterChart } from '@/components/charts/coherence-scatter-chart'
import { TdomHistoryChart } from '@/components/charts/tdom-history-chart'
import { SignalLineChart } from '@/components/charts/signal-line-chart'
import { RawClockPanel } from '@/components/panels/raw-clock-panel'
import { SmoothClockPanel } from '@/components/panels/smooth-clock-panel'
import { DiagnosticsPanel } from '@/components/panels/diagnostics-panel'
import { useAnalysisStore } from '@/stores/analysis.store'
import { usePortfolioStore } from '@/stores/portfolio.store'
import { useCoherenceHistoryStore } from '@/stores/coherence-history.store'
import { Card, CardContent, CardTitle, CardHeader } from '@/components/ui/card'
import { useRouter } from '@tanstack/react-router'
import { useChartTimeframeStore } from '@/stores/chart-timeframe.store'
import { ChartTimeframeButtons } from '@/components/charts/chart-timeframe-buttons'
import type { SmoothAnalysis } from '@/schemas/analysis'

const CLASS_COLORS: Record<string, string> = {
  stable_loop: '#50dd80',
  unstable_loop: '#ffaa33',
  drift: '#8a8f98',
  chaotic: '#ff5050',
}

export function DashboardPage() {
  const raw = useAnalysisStore((s) => s.raw)
  const smooth = useAnalysisStore((s) => s.smooth)
  const coherencePoints = useCoherenceHistoryStore((s) => s.points)
  const trades = usePortfolioStore((s) => s.trades)
  const router = useRouter()
  const chartRange = useChartTimeframeStore((s) => s.range)

  return (
    <div className="space-y-3">
      <HmmStateBanner smooth={smooth} />

      {/* 1. Input signals: price → returns → denoised */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Raw Price
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">OHLC candles</span>
            </CardTitle>
            <ChartTimeframeButtons />
          </CardHeader>
          <CardContent>
            <PriceChart visibleRangeMinutes={chartRange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Log Returns
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">log(p/p_prev) &middot; raw signal</span>
            </CardTitle>
            <ChartTimeframeButtons />
          </CardHeader>
          <CardContent>
            <SignalLineChart
              data={smooth?.pipelineReturns ?? []}
              timestamps={smooth?.pipelineTimestamps}
              color="rgba(255,255,255,0.7)"
              visibleRangeMinutes={chartRange}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Denoised Returns
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">post MAD + Haar &middot; into Goertzel</span>
            </CardTitle>
            <ChartTimeframeButtons />
          </CardHeader>
          <CardContent>
            <SignalLineChart
              data={smooth?.pipelineDenoised ?? []}
              timestamps={smooth?.pipelineTimestamps}
              color="#7170ff"
              visibleRangeMinutes={chartRange}
            />
          </CardContent>
        </Card>
      </div>

      {/* 2. Dominant period + Coherence + PPC + Hurst side by side */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Dominant Period (T_dom)
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">Goertzel &middot; {coherencePoints.length} pts</span>
            </CardTitle>
            <ChartTimeframeButtons />
          </CardHeader>
          <CardContent>
            <TdomHistoryChart points={coherencePoints} visibleRangeMinutes={chartRange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Coherence
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">VM R&#x0304; &middot; biased</span>
            </CardTitle>
            <ChartTimeframeButtons />
          </CardHeader>
          <CardContent>
            <CoherenceHistoryChart points={coherencePoints} visibleRangeMinutes={chartRange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              PPC
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">bias-free coherence</span>
            </CardTitle>
            <ChartTimeframeButtons />
          </CardHeader>
          <CardContent>
            <PpcHistoryChart points={coherencePoints} visibleRangeMinutes={chartRange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Hurst Exponent
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">H&lt;0.5 cyclic &middot; H&gt;0.55 trend</span>
            </CardTitle>
            <ChartTimeframeButtons />
          </CardHeader>
          <CardContent>
            <HurstHistoryChart points={coherencePoints} visibleRangeMinutes={chartRange} />
          </CardContent>
        </Card>
      </div>

      {/* 3. Topology status + DFT + Goertzel side by side */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <TopologyCard smooth={smooth} router={router} />

        <Card>
          <CardHeader>
            <CardTitle>
              Batch DFT Spectrum
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">log returns &middot; Hann window</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpectrumChart
              frequencies={raw?.frequencies ?? []}
              dominantK={raw?.dominantK ?? 0}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Goertzel Tracker Spectrum
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">causal decay &middot; sets tDom</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpectrumChart
              frequencies={smooth?.goertzelSpectrum ?? []}
              dominantK={smooth?.goertzelDomK ?? 0}
            />
          </CardContent>
        </Card>
      </div>

      {/* 5. Phase clocks + metrics panels */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-[420px_1fr_420px_1fr]">
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <CardTitle>
              Raw Phase Clock
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">Fourier</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 items-center justify-center p-4" style={{ minHeight: 400 }}>
            <PhaseClock
              canvasId="raw-clock"
              position={raw?.cyclePosition ?? 0}
              rBar={raw?.rBar ?? 0}
              meanPhase={raw?.meanPhase ?? 0}
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <CardTitle>
              Fourier Metrics
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">DFT analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto">
            <RawClockPanel raw={raw} />
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <CardTitle>
              Smooth Phase Clock
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">Takens &middot; VM &middot; HMM</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 items-center justify-center p-4" style={{ minHeight: 400 }}>
            <PhaseClock
              canvasId="smooth-clock"
              position={smooth?.clockPosition ?? 0}
              rBar={smooth ? Math.min(smooth.vmKappa / 10, 1) : 0}
              meanPhase={smooth?.vmMu ?? 0}
              trail={smooth?.trail}
              kappa={smooth?.vmKappa}
              hmmAlpha={smooth?.hmmAlpha}
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <CardTitle>
              Smooth Metrics
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">causal pipeline</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto">
            <SmoothClockPanel smooth={smooth} />
          </CardContent>
        </Card>
      </div>

      {/* 6. Trading analytics */}
      <Card>
        <CardHeader>
          <CardTitle>
            Coherence vs Return
            <span className="ml-2 text-[11px] font-normal text-[#62666d]">R&#x0304; at entry &middot; does structure pay?</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CoherenceScatterChart trades={trades} />
        </CardContent>
      </Card>

      {/* 7. Diagnostics */}
      <DiagnosticsPanel smooth={smooth} />
    </div>
  )
}

const TopologyCard = memo(function TopologyCard({ smooth, router }: { smooth: SmoothAnalysis | null; router: ReturnType<typeof useRouter> }) {
  const topoClass = smooth?.topologyClass
  const topoScore = smooth?.topologyScore
  const classColor = topoClass ? CLASS_COLORS[topoClass] ?? '#8a8f98' : undefined

  return (
    <button
      onClick={() => void router.navigate({ to: '/topology' })}
      className="text-left transition-colors hover:ring-1 hover:ring-[rgba(255,255,255,0.1)] rounded-xl"
    >
      <Card className="h-full">
        <CardHeader>
          <CardTitle>
            Topology
            <span className="ml-2 text-[11px] font-normal text-[#62666d]">attractor structure</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-4">
            {topoClass && classColor ? (
              <>
                <span
                  className="rounded-lg px-3 py-1.5 font-mono text-sm font-[590]"
                  style={{ backgroundColor: `${classColor}22`, color: classColor }}
                >
                  {topoClass.replace('_', ' ')}
                </span>
                <div className="flex w-full items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((topoScore ?? 0) * 100)}%`,
                        backgroundColor: classColor,
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs text-[#d0d6e0]">
                    {topoScore !== undefined ? `${(topoScore * 100).toFixed(0)}%` : '\u2014'}
                  </span>
                </div>
                <div className="grid w-full grid-cols-2 gap-1.5 text-[10px]">
                  <div className="flex justify-between rounded bg-[#08090a] px-2 py-1">
                    <span className="text-[#62666d]">Winding</span>
                    <span className="font-mono text-[#d0d6e0]">{smooth?.absWinding?.toFixed(2) ?? '\u2014'}</span>
                  </div>
                  <div className="flex justify-between rounded bg-[#08090a] px-2 py-1">
                    <span className="text-[#62666d]">Closure</span>
                    <span className="font-mono text-[#d0d6e0]">{smooth?.loopClosure !== undefined ? `${(smooth.loopClosure * 100).toFixed(0)}%` : '\u2014'}</span>
                  </div>
                </div>
              </>
            ) : (
              <span className="text-[11px] text-[#62666d]">Waiting for data...</span>
            )}
            <span className="text-[10px] text-[#62666d]">
              View details &rarr;
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  )
})

