import { memo } from 'react'
import type { SmoothAnalysis } from '@/schemas/analysis'
import { cn } from '@/lib/utils'

interface HmmStateBannerProps {
  smooth: SmoothAnalysis | null
}

const STATE_CONFIG = [
  { icon: '↗', title: 'RISING PHASE', desc: 'Attractor rising. HMM confirms upward momentum.', bg: 'bg-[rgba(113,112,255,0.07)]', border: 'border-[rgba(113,112,255,0.3)]', text: 'text-cycle-rising' },
  { icon: '▲', title: 'AT PEAK', desc: 'Attractor at maximum. Transition probability elevated.', bg: 'bg-[rgba(255,255,255,0.04)]', border: 'border-[rgba(255,255,255,0.15)]', text: 'text-cycle-peak' },
  { icon: '↘', title: 'FALLING PHASE', desc: 'Attractor descending. HMM confirms downward momentum.', bg: 'bg-[rgba(255,255,255,0.03)]', border: 'border-[rgba(255,255,255,0.10)]', text: 'text-cycle-falling' },
  { icon: '▼', title: 'AT TROUGH', desc: 'Attractor at minimum. Reversal probability elevated.', bg: 'bg-[rgba(255,255,255,0.02)]', border: 'border-[rgba(255,255,255,0.08)]', text: 'text-cycle-trough' },
] as const

const NO_STRUCTURE = {
  icon: '⟳',
  title: 'NO STRUCTURE',
  bg: 'bg-[rgba(255,255,255,0.02)]',
  border: 'border-[rgba(255,255,255,0.08)]',
  text: 'text-cycle-falling',
} as const

export const HmmStateBanner = memo(function HmmStateBanner({ smooth }: HmmStateBannerProps) {
  if (!smooth) {
    return (
      <div className="flex items-center gap-3.5 rounded-[8px] border border-[rgba(113,112,255,0.2)] bg-[rgba(113,112,255,0.05)] p-4">
        <span className="flex-shrink-0 text-[28px] leading-none">◌</span>
        <div className="flex-1">
          <div className="text-[16px] font-[590] uppercase tracking-[0.05em] text-[#f7f8f8]">READING NOW</div>
          <div className="text-[13px] font-[400] text-[#8a8f98]">Collecting data...</div>
        </div>
        <div className="text-right">
          <span className="text-[24px] font-[510] text-[#62666d]">—</span>
          <span className="block text-[10px] font-[510] uppercase tracking-[0.05em] text-[#62666d]">coherence</span>
        </div>
      </div>
    )
  }

  const isIncoherent = smooth.rBar < 0.12
  const stateIdx = smooth.hmmActiveState
  const config = isIncoherent ? NO_STRUCTURE : STATE_CONFIG[stateIdx]!
  const desc = isIncoherent
    ? `Phase incoherent — κ=${smooth.vmKappa.toFixed(1)}. No cycle dominates.`
    : STATE_CONFIG[stateIdx]!.desc

  return (
    <div className={cn('flex items-center gap-3.5 rounded-[8px] border p-4 transition-colors', config.bg, config.border)}>
      <span className="flex-shrink-0 text-[28px] leading-none">{config.icon}</span>
      <div className="flex-1">
        <div className="text-[16px] font-[590] uppercase tracking-[0.05em] text-[#f7f8f8]">{config.title}</div>
        <div className="text-[13px] font-[400] text-[#8a8f98]">{desc}</div>
      </div>
      <div className="flex-shrink-0 text-right">
        <span className={cn('text-[24px] font-[510]', config.text)}>
          {(smooth.rBar * 100).toFixed(0)}%
        </span>
        <span className="block text-[10px] font-[510] uppercase tracking-[0.05em] text-[#62666d]">coherence</span>
      </div>
    </div>
  )
})
