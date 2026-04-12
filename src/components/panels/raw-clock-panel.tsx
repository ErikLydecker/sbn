import { memo } from 'react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import type { RawAnalysis } from '@/schemas/analysis'

interface RawClockPanelProps {
  raw: RawAnalysis | null
}

export const RawClockPanel = memo(function RawClockPanel({ raw }: RawClockPanelProps) {
  const period = raw ? Math.round(raw.windowData.length / raw.dominantK) : null
  const freqHz = raw && period ? (1 / period) : null

  return (
    <Accordion type="multiple" defaultValue={['phase']}>
      <AccordionItem value="phase">
        <AccordionTrigger>Phase &amp; Position</AccordionTrigger>
        <AccordionContent>
          <Desc>
            Current phase angle and cycle position derived from the batch Fourier transform.
            Phase 0° = trough, 90° = rising, 180° = peak, 270° = falling.
          </Desc>
          <div className="space-y-1">
            <MetricRow
              label="Phase"
              value={raw ? `${raw.phaseDeg.toFixed(1)}°` : '—'}
              accent
            />
            <MetricRow
              label="Cycle position"
              value={raw ? `${(raw.cyclePosition * 100).toFixed(1)}%` : '—'}
            />
            <MetricRow
              label="Quadrant"
              value={raw ? quadrantLabel(raw.phaseDeg) : '—'}
            />
          </div>
          {raw && (
            <Interpretation>
              {raw.cyclePosition < 0.25
                ? 'Near trough — early cycle, potential accumulation zone.'
                : raw.cyclePosition < 0.5
                  ? 'Rising — momentum building, mid-cycle acceleration.'
                  : raw.cyclePosition < 0.75
                    ? 'Near peak — late cycle, watch for distribution.'
                    : 'Falling — declining phase, deceleration.'}
            </Interpretation>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="coherence">
        <AccordionTrigger>Coherence</AccordionTrigger>
        <AccordionContent>
          <Desc>
            R-bar measures how consistently the signal oscillates at the dominant frequency.
            Values near 1.0 mean a clean, locked cycle. Below ~0.12, the signal is effectively noise.
          </Desc>
          <div className="space-y-1">
            <MetricRow
              label="R̄ (coherence)"
              value={raw?.rBar.toFixed(3) ?? '—'}
              accent
              color={raw ? coherenceColor(raw.rBar) : undefined}
            />
            <MetricRow
              label="Mean phase"
              value={raw ? `${((raw.meanPhase * 180 / Math.PI + 360) % 360).toFixed(1)}°` : '—'}
            />
            <MetricRow
              label="Quality"
              value={raw ? coherenceLabel(raw.rBar) : '—'}
            />
          </div>
          {raw && (
            <Interpretation>
              {raw.rBar >= 0.4
                ? 'Strong coherence — dominant frequency explains most of the variance. Phase estimate is reliable.'
                : raw.rBar >= 0.12
                  ? 'Moderate coherence — cycle is present but noisy. Phase estimates have meaningful uncertainty.'
                  : 'Incoherent — no clear dominant cycle. Phase values are unreliable.'}
            </Interpretation>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="frequency" className="border-b-0">
        <AccordionTrigger>Dominant Frequency</AccordionTrigger>
        <AccordionContent>
          <Desc>
            The frequency bin with the highest spectral energy. Period = window_length / k.
            This is the batch DFT estimate — it uses the full window and recomputes each bar.
          </Desc>
          <div className="space-y-1">
            <MetricRow
              label="Dominant k"
              value={raw ? `${raw.dominantK}` : '—'}
              accent
            />
            <MetricRow
              label="Period T"
              value={period ? `${period} bars` : '—'}
            />
            <MetricRow
              label="Frequency"
              value={freqHz ? `${freqHz.toFixed(4)} cycles/bar` : '—'}
            />
            <MetricRow
              label="Window size"
              value={raw ? `${raw.windowData.length} bars` : '—'}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
})

function quadrantLabel(deg: number): string {
  if (deg < 90) return 'Trough → Rising'
  if (deg < 180) return 'Rising → Peak'
  if (deg < 270) return 'Peak → Falling'
  return 'Falling → Trough'
}

function coherenceColor(rBar: number): string {
  if (rBar >= 0.4) return '#7170ff'
  if (rBar >= 0.12) return '#8a8f98'
  return '#ff5050'
}

function coherenceLabel(rBar: number): string {
  if (rBar >= 0.4) return 'Strong'
  if (rBar >= 0.2) return 'Moderate'
  if (rBar >= 0.12) return 'Weak'
  return 'Incoherent'
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
