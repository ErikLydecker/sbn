import { memo } from 'react'
import type { SmoothAnalysis } from '@/schemas/analysis'

interface TopologyPanelProps {
  smooth: SmoothAnalysis | null
}

export const TopologyPanel = memo(function TopologyPanel({ smooth }: TopologyPanelProps) {
  const rows: [string, string, string?][] = [
    [
      'Correlation dim (D\u2082)',
      smooth?.corrDimEstimate !== undefined ? smooth.corrDimEstimate.toFixed(2) : '\u2014',
      'text-cycle-rising',
    ],
    [
      'Recurrence rate',
      smooth?.recurrenceRate !== undefined ? `${(smooth.recurrenceRate * 100).toFixed(1)}%` : '\u2014',
      'text-cycle-peak',
    ],
    [
      'Embed dim m',
      smooth ? `${smooth.embeddingDim}D` : '\u2014',
    ],
    [
      'Delay \u03C4',
      smooth ? `${smooth.tau} bars` : '\u2014',
    ],
    [
      'Embed span',
      smooth ? `${smooth.embedSpan} bars` : '\u2014',
    ],
    [
      'Viz points',
      smooth?.embeddingVecs ? `${smooth.embeddingVecs.length}` : '\u2014',
    ],
  ]

  const corrDim = smooth?.corrDimEstimate
  const rr = smooth?.recurrenceRate
  let interpretation = ''
  if (corrDim !== undefined && corrDim > 0) {
    if (corrDim < 2) interpretation += `D\u2082\u2248${corrDim.toFixed(1)} \u2192 low-dimensional dynamics. `
    else if (corrDim < 4) interpretation += `D\u2082\u2248${corrDim.toFixed(1)} \u2192 moderate attractor complexity. `
    else interpretation += `D\u2082\u2248${corrDim.toFixed(1)} \u2192 high-dimensional / noisy. `
  }
  if (rr !== undefined) {
    if (rr > 0.3) interpretation += 'High recurrence \u2192 strong periodic structure.'
    else if (rr > 0.1) interpretation += 'Moderate recurrence \u2192 quasi-periodic.'
    else if (rr > 0) interpretation += 'Low recurrence \u2192 weakly structured.'
  }

  return (
    <div>
      <div className="mb-1.5 text-[10px] font-[590] uppercase tracking-[0.06em] text-[#8a8f98]">
        Topology Diagnostics
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {rows.map(([label, value, colorClass]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-[6px] border border-[rgba(255,255,255,0.05)] bg-[#08090a] px-2.5 py-1.5"
          >
            <span className="text-[10px] font-[510] tracking-[0.04em] text-[#62666d]">{label}</span>
            <span className={`font-mono text-[13px] font-[510] ${colorClass ?? 'text-[#d0d6e0]'}`}>{value}</span>
          </div>
        ))}
      </div>
      {interpretation && (
        <p className="mt-2 text-[10px] font-normal leading-relaxed text-[#62666d]">
          {interpretation}
        </p>
      )}
    </div>
  )
})
