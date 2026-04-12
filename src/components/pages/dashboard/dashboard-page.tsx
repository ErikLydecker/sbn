import { HmmStateBanner } from '@/components/panels/hmm-state-banner'
import { PriceChart } from '@/components/charts/price-chart'
import { PhaseClock } from '@/components/charts/phase-clock'
import { SpectrumChart } from '@/components/charts/spectrum-chart'
import { Attractor3dChart } from '@/components/charts/attractor-3d-chart'
import { Attractor2dChart } from '@/components/charts/attractor-2d-chart'
import { RecurrenceChart } from '@/components/charts/recurrence-chart'
import { CoherenceHistoryChart } from '@/components/charts/coherence-history-chart'
import { RecurrenceHistoryChart } from '@/components/charts/recurrence-history-chart'
import { StructureHistoryChart } from '@/components/charts/structure-history-chart'
import { CoherenceScatterChart } from '@/components/charts/coherence-scatter-chart'
import { TdomHistoryChart } from '@/components/charts/tdom-history-chart'
import { SignalLineChart } from '@/components/charts/signal-line-chart'
import { RawClockPanel } from '@/components/panels/raw-clock-panel'
import { SmoothClockPanel } from '@/components/panels/smooth-clock-panel'
import { DiagnosticsPanel } from '@/components/panels/diagnostics-panel'
import { TopologyPanel } from '@/components/panels/topology-panel'
import { useAnalysisStore } from '@/stores/analysis.store'
import { usePriceStore } from '@/stores/price.store'
import { usePortfolioStore } from '@/stores/portfolio.store'
import { useCoherenceHistoryStore } from '@/stores/coherence-history.store'
import { Card, CardContent, CardTitle, CardHeader } from '@/components/ui/card'

export function DashboardPage() {
  const raw = useAnalysisStore((s) => s.raw)
  const smooth = useAnalysisStore((s) => s.smooth)
  const candles = usePriceStore((s) => s.candles)
  const coherencePoints = useCoherenceHistoryStore((s) => s.points)
  const trades = usePortfolioStore((s) => s.trades)

  return (
    <div className="space-y-3">
      <HmmStateBanner smooth={smooth} />

      <Card>
        <CardHeader>
          <CardTitle>
            Dominant Period (T_dom)
            <span className="ml-2 text-[11px] font-normal text-[#62666d]">Goertzel tracker &middot; all windows scale from this</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TdomHistoryChart points={coherencePoints} />
        </CardContent>
      </Card>

      {/* 1. Input signals: price → returns → denoised */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              Raw Price
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">OHLC candles</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PriceChart candles={candles} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Log Returns
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">log(p/p_prev) &middot; raw signal</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SignalLineChart
              data={smooth?.pipelineReturns ?? []}
              color="rgba(255,255,255,0.7)"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Denoised Returns
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">post MAD + Haar &middot; into Goertzel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SignalLineChart
              data={smooth?.pipelineDenoised ?? []}
              color="#7170ff"
            />
          </CardContent>
        </Card>
      </div>

      {/* 2. Quality metrics: coherence, recurrence, structure */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              Coherence
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">VM R̄ &middot; {coherencePoints.length} pts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CoherenceHistoryChart points={coherencePoints} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Recurrence Rate
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">phase-space revisitation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecurrenceHistoryChart points={coherencePoints} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Structure
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">attractor symmetry</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StructureHistoryChart points={coherencePoints} />
          </CardContent>
        </Card>
      </div>

      {/* 3. Frequency decomposition: DFT + Goertzel → tDom */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
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

      {/* 4. Takens embedding: attractor geometry */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              3D Attractor
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">PCA projection &middot; drag to rotate</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Attractor3dChart pts={smooth?.embeddingVecs ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              2D Projection
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">PC1 vs PC2 &middot; phase extraction plane</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Attractor2dChart pts={smooth?.embeddingVecs ?? []} />
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
            <span className="ml-2 text-[11px] font-normal text-[#62666d]">R̄ at entry &middot; does structure pay?</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CoherenceScatterChart trades={trades} />
        </CardContent>
      </Card>

      {/* 7. Diagnostics */}
      <DiagnosticsPanel smooth={smooth} />

      {/* 8. Recurrence + topology */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Recurrence Plot
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">R(i,j) = &#x2016;v&#x1D62;&minus;v&#x2C7C;&#x2016; &lt; &epsilon;</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecurrenceChart
              matrix={smooth?.recurrenceMatrix ?? []}
              size={smooth?.recurrenceSize ?? 0}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Embedding Topology</CardTitle>
          </CardHeader>
          <CardContent>
            <TopologyPanel smooth={smooth} />
          </CardContent>
        </Card>
      </div>

    </div>
  )
}

