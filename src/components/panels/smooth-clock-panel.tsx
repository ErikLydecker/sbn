import { memo } from 'react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { CoherenceBar } from '@/components/panels/coherence-bar'
import type { SmoothAnalysis } from '@/schemas/analysis'

interface SmoothClockPanelProps {
  smooth: SmoothAnalysis | null
}

const STATE_NAMES = ['Rising', 'Peak', 'Falling', 'Trough'] as const

export const SmoothClockPanel = memo(function SmoothClockPanel({ smooth }: SmoothClockPanelProps) {
  const activeIdx = smooth?.hmmActiveState ?? -1

  return (
    <div className="space-y-3">
      <CoherenceBar
        kappa={smooth?.vmKappa ?? 0}
        rBar={smooth?.rBar ?? 0}
        tDom={smooth?.tDom}
        tDomFrac={smooth?.tDomFrac}
      />
    <Accordion type="multiple" defaultValue={['phase']}>
      <AccordionItem value="phase">
        <AccordionTrigger>Phase &amp; Coherence</AccordionTrigger>
        <AccordionContent>
          <Desc>
            Phase estimated from Takens delay-embedding, filtered through a Von Mises distribution.
            Kappa (κ) is the concentration parameter — higher means the phase estimate is more certain.
          </Desc>
          <div className="space-y-1">
            <MetricRow
              label="Phase"
              value={smooth ? `${smooth.phaseDeg.toFixed(1)}°` : '—'}
              accent
            />
            <MetricRow
              label="VM κ (concentration)"
              value={smooth?.vmKappa.toFixed(2) ?? '—'}
              color={smooth ? kappaColor(smooth.vmKappa) : undefined}
            />
            <MetricRow
              label="R̄ (coherence)"
              value={smooth?.rBar.toFixed(3) ?? '—'}
              color={smooth ? coherenceColor(smooth.rBar) : undefined}
            />
            <MetricRow
              label="PPC (bias-free)"
              value={smooth?.ppc !== undefined ? smooth.ppc.toFixed(3) : '—'}
              color={smooth?.ppc !== undefined ? coherenceColor(smooth.ppc) : undefined}
            />
            <MetricRow
              label="Clock position"
              value={smooth ? `${(smooth.clockPosition * 100).toFixed(1)}%` : '—'}
            />
            <MetricRow
              label="Clock velocity"
              value={smooth ? smooth.clockVelocity.toFixed(4) : '—'}
            />
          </div>
          {smooth && (
            <Interpretation>
              {smooth.vmKappa >= 2.5
                ? `Strong phase lock (κ=${smooth.vmKappa.toFixed(1)}) — cycle is well-defined, phase estimates are reliable for timing.`
                : smooth.vmKappa >= 1.0
                  ? `Moderate concentration (κ=${smooth.vmKappa.toFixed(1)}) — cycle present but noisy, trade signals less certain.`
                  : `Weak concentration (κ=${smooth.vmKappa.toFixed(1)}) — phase is poorly defined, signals should be discounted.`}
            </Interpretation>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="hmm">
        <AccordionTrigger>HMM Regime</AccordionTrigger>
        <AccordionContent>
          <Desc>
            Hidden Markov Model assigns probability to four cycle states.
            The active state drives regime classification and trade entry logic.
            Dwell is the expected bars per state; p_self is the self-transition probability.
          </Desc>
          <div className="space-y-1">
            <MetricRow
              label="Active state"
              value={smooth ? STATE_NAMES[activeIdx] ?? '—' : '—'}
              accent
              color={smooth && activeIdx >= 0 ? undefined : undefined}
            />
            {STATE_NAMES.map((name, i) => (
              <MetricRow
                key={name}
                label={`P(${name})`}
                value={smooth?.hmmAlpha ? `${(smooth.hmmAlpha[i]! * 100).toFixed(1)}%` : '—'}
                color={i === activeIdx ? stateHexColor(i) : undefined}
              />
            ))}
            <MetricRow
              label="Dwell"
              value={smooth ? `${smooth.hmmDwell} bars/state` : '—'}
            />
            <MetricRow
              label="p_self"
              value={smooth ? smooth.hmmPSelf.toFixed(3) : '—'}
            />
          </div>
          {smooth && (
            <Interpretation>
              {smooth.hmmAlpha
                ? `Dominant state: ${STATE_NAMES[activeIdx]} at ${(smooth.hmmAlpha[activeIdx]! * 100).toFixed(0)}% probability. ` +
                  (smooth.hmmPSelf > 0.9
                    ? 'High p_self → regime is sticky, transitions are rare.'
                    : 'Moderate p_self → regime transitions happen frequently.')
                : ''}
            </Interpretation>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="period">
        <AccordionTrigger>Dominant Period</AccordionTrigger>
        <AccordionContent>
          <Desc>
            T_dom is the estimated dominant cycle length in bars. The Goertzel tracker maintains this
            causally (no batch recompute). Confidence reflects how long the current bin has been dominant.
          </Desc>
          <div className="space-y-1">
            <MetricRow
              label="T_dom"
              value={smooth ? `${smooth.tDom} bars` : '—'}
              accent
            />
            {smooth?.tDomFrac !== undefined && (
              <MetricRow
                label="T_dom (fractional)"
                value={`${smooth.tDomFrac.toFixed(2)} bars`}
              />
            )}
            {smooth?.goertzelDomK !== undefined && (
              <MetricRow
                label="Goertzel peak k"
                value={`${smooth.goertzelDomK}`}
              />
            )}
            {smooth?.goertzelConfidence !== undefined && (
              <MetricRow
                label="Bin confidence"
                value={`${(smooth.goertzelConfidence * 100).toFixed(0)}%`}
                color={smooth.goertzelConfidence > 0.7 ? '#7170ff' : undefined}
              />
            )}
          </div>
          {smooth && (
            <Interpretation>
              {`Cycle length ≈ ${smooth.tDom} bars. All downstream windows (embedding, phase, VM horizon, HMM dwell) scale proportionally.`}
            </Interpretation>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="embedding">
        <AccordionTrigger>Embedding Parameters</AccordionTrigger>
        <AccordionContent>
          <Desc>
            Takens delay-embedding reconstructs the attractor from a single time series.
            Dimension (m) and delay (τ) determine the state-space geometry.
            The embed span = (m-1)×τ is how many bars of history each point encodes.
          </Desc>
          <div className="space-y-1">
            <MetricRow
              label="Dimension m"
              value={smooth ? `${smooth.embeddingDim}D` : '—'}
              accent
            />
            <MetricRow
              label="Delay τ"
              value={smooth ? `${smooth.tau} bars` : '—'}
            />
            <MetricRow
              label="Embed span"
              value={smooth ? `${smooth.embedSpan} bars` : '—'}
            />
            <MetricRow
              label="Phase window"
              value={smooth ? `${smooth.phaseWindow} bars` : '—'}
            />
            <MetricRow
              label="Bar count"
              value={smooth ? `${smooth.barCount}` : '—'}
            />
          </div>
          {smooth && (
            <Interpretation>
              {`${smooth.embeddingDim}D embedding with τ=${smooth.tau} → each attractor point spans ${smooth.embedSpan} bars of history. ` +
               `Phase extracted from ${smooth.phaseWindow}-bar window (2.5×T_dom).`}
            </Interpretation>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="vonmises" className="border-b-0">
        <AccordionTrigger>Von Mises Filter</AccordionTrigger>
        <AccordionContent>
          <Desc>
            Exponentially-weighted circular filter that smooths noisy Takens phase angles.
            The horizon controls how many recent bars influence the estimate.
            Shorter horizon = more responsive but noisier.
          </Desc>
          <div className="space-y-1">
            <MetricRow
              label="Horizon"
              value={smooth ? `${smooth.vmHorizon} bars` : '—'}
              accent
            />
            <MetricRow
              label="λ (decay)"
              value={smooth ? smooth.vmLambda.toFixed(4) : '—'}
            />
            <MetricRow
              label="μ (mean direction)"
              value={smooth ? `${((smooth.vmMu * 180 / Math.PI + 360) % 360).toFixed(1)}°` : '—'}
            />
            <MetricRow
              label="κ (concentration)"
              value={smooth ? smooth.vmKappa.toFixed(2) : '—'}
            />
          </div>
          {smooth && (
            <Interpretation>
              {`Horizon = ${smooth.vmHorizon} bars (0.55×T_dom). ` +
               (smooth.vmHorizon > 10
                 ? 'Long horizon → stable phase estimate, slower to react to genuine shifts.'
                 : 'Short horizon → responsive to changes but more noise in the estimate.')}
            </Interpretation>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
    </div>
  )
})

function stateHexColor(idx: number): string {
  const colors = ['#7170ff', '#d0d6e0', '#8a8f98', '#62666d']
  return colors[idx] ?? '#d0d6e0'
}

function kappaColor(kappa: number): string {
  if (kappa >= 2.5) return '#7170ff'
  if (kappa >= 1.0) return '#8a8f98'
  return '#ff5050'
}

function coherenceColor(rBar: number): string {
  if (rBar >= 0.4) return '#7170ff'
  if (rBar >= 0.12) return '#8a8f98'
  return '#ff5050'
}

function Desc({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[10px] leading-relaxed text-[#62666d]">{children}</p>
}

function Interpretation({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[9px] leading-relaxed text-[#4a4d54]">{children}</p>
}

function MetricRow({ label, value, accent, color }: {
  label: string; value: string; accent?: boolean; color?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-[6px] border border-[rgba(255,255,255,0.05)] bg-[#08090a] px-2.5 py-1.5">
      <span className="text-[10px] font-[510] tracking-[0.04em] text-[#62666d]">{label}</span>
      <span
        className={`font-mono text-[13px] font-[510] ${accent ? 'text-[#7170ff]' : 'text-[#d0d6e0]'}`}
        style={color ? { color } : undefined}
      >{value}</span>
    </div>
  )
}
