import { memo } from 'react'
import type { SmoothAnalysis } from '@/schemas/analysis'

const CLASS_COLORS: Record<string, string> = {
  stable_loop: '#50dd80',
  unstable_loop: '#ffaa33',
  drift: '#8a8f98',
  chaotic: '#ff5050',
}

interface TopologyPanelProps {
  smooth: SmoothAnalysis | null
  matchCount?: number
}

export const TopologyPanel = memo(function TopologyPanel({ smooth, matchCount }: TopologyPanelProps) {
  const topoClass = smooth?.topologyClass
  const classColor = topoClass ? CLASS_COLORS[topoClass] ?? '#8a8f98' : undefined

  const rows: [string, string, string?][] = [
    [
      'Topology class',
      topoClass ? topoClass.replace('_', ' ') : '\u2014',
      classColor ? `text-[${classColor}]` : undefined,
    ],
    [
      'Topology score',
      smooth?.topologyScore !== undefined ? `${(smooth.topologyScore * 100).toFixed(0)}%` : '\u2014',
      'text-cycle-rising',
    ],
    [
      'Winding number',
      smooth?.windingNumber !== undefined ? smooth.windingNumber.toFixed(2) : '\u2014',
    ],
    [
      '|Winding|',
      smooth?.absWinding !== undefined ? smooth.absWinding.toFixed(2) : '\u2014',
      smooth?.absWinding !== undefined && smooth.absWinding >= 0.7 ? 'text-[#50dd80]' : undefined,
    ],
    [
      'Circulation',
      smooth?.circulation !== undefined ? smooth.circulation.toFixed(4) : '\u2014',
    ],
    [
      'Loop closure',
      smooth?.loopClosure !== undefined ? `${(smooth.loopClosure * 100).toFixed(0)}%` : '\u2014',
    ],
    [
      'Stability',
      smooth?.topologyStability !== undefined ? `${(smooth.topologyStability * 100).toFixed(0)}%` : '\u2014',
    ],
    [
      'Correlation dim (D\u2082)',
      smooth?.corrDimEstimate !== undefined ? smooth.corrDimEstimate.toFixed(2) : '\u2014',
      'text-cycle-rising',
    ],
    [
      'RR (fixed)',
      smooth?.fixedRecurrenceRate !== undefined ? `${(smooth.fixedRecurrenceRate * 100).toFixed(1)}%` : '\u2014',
      'text-cycle-peak',
    ],
    [
      'RR (pctl)',
      smooth?.recurrenceRate !== undefined ? `${(smooth.recurrenceRate * 100).toFixed(1)}%` : '\u2014',
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
    [
      'Phase basis',
      smooth?.subspaceStability !== undefined ? `${(smooth.subspaceStability * 100).toFixed(0)}%` : '\u2014',
      smooth?.subspaceStability !== undefined && smooth.subspaceStability < 0.9 ? 'text-cycle-peak' : undefined,
    ],
  ]

  if (matchCount !== undefined) {
    rows.push([
      'Fingerprint matches',
      `${matchCount}`,
      matchCount > 0 ? 'text-[#50dd80]' : undefined,
    ])
  }

  const corrDim = smooth?.corrDimEstimate
  const rr = smooth?.fixedRecurrenceRate
  let interpretation = ''

  if (topoClass) {
    switch (topoClass) {
      case 'stable_loop':
        interpretation += 'Stable loop detected \u2192 strong periodic structure. '
        break
      case 'unstable_loop':
        interpretation += 'Unstable loop \u2192 periodic but deforming. '
        break
      case 'drift':
        interpretation += 'No loop structure \u2192 drifting dynamics. '
        break
      case 'chaotic':
        interpretation += 'Chaotic topology \u2192 tangled / complex. '
        break
    }
  }

  if (corrDim !== undefined && corrDim > 0) {
    if (corrDim < 2) interpretation += `D\u2082\u2248${corrDim.toFixed(1)} \u2192 low-dimensional. `
    else if (corrDim < 4) interpretation += `D\u2082\u2248${corrDim.toFixed(1)} \u2192 moderate complexity. `
    else interpretation += `D\u2082\u2248${corrDim.toFixed(1)} \u2192 high-dimensional / noisy. `
  }
  if (rr !== undefined) {
    if (rr > 0.3) interpretation += 'High recurrence \u2192 strong periodicity.'
    else if (rr > 0.1) interpretation += 'Moderate recurrence \u2192 quasi-periodic.'
    else if (rr > 0) interpretation += 'Low recurrence \u2192 weakly structured.'
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10px] font-[590] uppercase tracking-[0.06em] text-[#8a8f98]">
          Topology Diagnostics
        </span>
        {topoClass && classColor && (
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px] font-[590]"
            style={{ backgroundColor: `${classColor}22`, color: classColor }}
          >
            {topoClass.replace('_', ' ')}
          </span>
        )}
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
