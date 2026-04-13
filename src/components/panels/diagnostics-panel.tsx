import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DSP_CONFIG } from '@/config/dsp'
import { useSettingsStore } from '@/stores/settings.store'
import { useAnalysisStore } from '@/stores/analysis.store'
import { useBarCountdown, formatCountdown } from '@/hooks/use-bar-countdown'
import type { SmoothAnalysis } from '@/schemas/analysis'

interface DiagnosticsPanelProps {
  smooth: SmoothAnalysis | null
}

const gCfg = DSP_CONFIG.goertzel
const effectiveMemory = Math.ceil(1 / (1 - gCfg.lambda))

function formatAgo(ms: number): string {
  if (ms <= 0) return 'just now'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  return `${min}m ${sec % 60}s ago`
}

export const DiagnosticsPanel = memo(function DiagnosticsPanel({ smooth }: DiagnosticsPanelProps) {
  const timeframe = useSettingsStore((s) => s.timeframe)
  const lastAnalysisAt = useAnalysisStore((s) => s.lastAnalysisAt)
  const { remainingMs, pct } = useBarCountdown()

  const agoMs = lastAnalysisAt > 0 ? Date.now() - lastAnalysisAt : -1

  const isGoertzelActive = gCfg.useGoertzel && smooth?.tDomFrac !== undefined
  const trackerLabel = !gCfg.useGoertzel
    ? 'Batch DFT'
    : isGoertzelActive
      ? 'Goertzel'
      : 'Warmup (batch DFT)'

  const trackerRows: [string, string, string?][] = [
    [
      'Tracker',
      smooth ? trackerLabel : '—',
      isGoertzelActive ? 'text-cycle-rising' : undefined,
    ],
    [
      'T_dom',
      smooth ? `${smooth.tDom} bars` : '—',
      'text-cycle-peak',
    ],
  ]

  if (isGoertzelActive && smooth?.tDomFrac !== undefined) {
    trackerRows.push([
      'T_dom (frac)',
      `${smooth.tDomFrac.toFixed(2)} bars`,
      'text-cycle-peak',
    ])
  }

  if (gCfg.useGoertzel) {
    trackerRows.push(
      ['Eff. memory', `${effectiveMemory} bars  (λ=${gCfg.lambda})`],
      ['Sanity check', `every ~${smooth ? Math.round(smooth.tDom * gCfg.sanityIntervalMultiplier) : '?'} bars  (reseed >${(gCfg.dftReseedThreshold * 100).toFixed(0)}%)`],
    )
  }

  const paramRows: [string, string, string?][] = [
    ['Event bars', smooth ? `${smooth.barCount} bars` : '—'],
    ['Delay τ', smooth ? `${smooth.tau} bars` : '—'],
    ['Embed dim m', smooth ? `${smooth.embeddingDim}D` : '—'],
    ['Embed span (m-1)τ', smooth ? `${smooth.embedSpan} bars  (target: ${smooth.tDom})` : '—'],
    ['Phase window', smooth ? `${smooth.phaseWindow} bars` : '—'],
    ['VM horizon', smooth ? `${smooth.vmHorizon} bars  (λ=${smooth.vmLambda.toFixed(3)})` : '—'],
    ['HMM dwell D', smooth ? `${smooth.hmmDwell} bars/state` : '—'],
    ['HMM p_self', smooth ? smooth.hmmPSelf.toFixed(2) : '—'],
    ['Bar count', smooth ? `${smooth.barCount} bars` : '—'],
    [
      'Hurst H',
      smooth?.hurst !== undefined ? smooth.hurst.toFixed(3) : '—',
      smooth?.hurst !== undefined
        ? smooth.hurst < 0.45 ? 'text-[#50dd80]'
          : smooth.hurst > 0.55 ? 'text-[#ff5050]'
          : undefined
        : undefined,
    ],
    [
      'PPC',
      smooth?.ppc !== undefined ? smooth.ppc.toFixed(3) : '—',
    ],
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Stack Diagnostics &mdash; live T_dom-adaptive params</CardTitle>
          <CandleTimer
            remaining={formatCountdown(remainingMs)}
            ago={agoMs >= 0 ? formatAgo(agoMs) : null}
            timeframe={timeframe}
            pct={pct}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-1.5 text-[10px] font-[590] uppercase tracking-[0.06em] text-[#8a8f98]">
          Frequency Tracking
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {trackerRows.map(([label, value, colorClass]) => (
            <DiagRow key={label} label={label} value={value} colorClass={colorClass} />
          ))}
        </div>

        <div className="mb-1.5 mt-3 text-[10px] font-[590] uppercase tracking-[0.06em] text-[#8a8f98]">
          Downstream Parameters
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {paramRows.map(([label, value, colorClass]) => (
            <DiagRow key={label} label={label} value={value} colorClass={colorClass} />
          ))}
        </div>

        <p className="mt-2 text-[10px] font-normal leading-relaxed text-[#62666d]">
          {gCfg.useGoertzel
            ? 'Causal Goertzel bank tracks the dominant frequency incrementally. Batch DFT validates every ~T_dom bars; reseed on >25% divergence. '
            : ''}
          All windows scale with T_dom. Embed span targets 1.0×T_dom. Phase window = 2.5×T_dom. VM horizon = 0.55×T_dom. HMM dwell = T_dom/4.
        </p>
      </CardContent>
    </Card>
  )
})

function CandleTimer({ remaining, ago, timeframe, pct }: { remaining: string; ago: string | null; timeframe: string; pct: number }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      {ago && (
        <span className="text-[10px] font-[510] text-[#62666d]">
          updated {ago}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <div className="h-[3px] w-16 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
            style={{ width: `${(pct * 100).toFixed(1)}%` }}
          />
        </div>
        <span className="font-mono text-[11px] font-[510] text-[#8a8f98]">
          {remaining}
        </span>
        <span className="text-[10px] font-[510] text-[#62666d]">
          {timeframe}
        </span>
      </div>
    </div>
  )
}

function DiagRow({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="flex items-center justify-between rounded-[6px] border border-[rgba(255,255,255,0.05)] bg-[#08090a] px-2.5 py-1.5">
      <span className="text-[10px] font-[510] tracking-[0.04em] text-[#62666d]">{label}</span>
      <span className={`font-mono text-[13px] font-[510] ${colorClass ?? 'text-[#d0d6e0]'}`}>{value}</span>
    </div>
  )
}
