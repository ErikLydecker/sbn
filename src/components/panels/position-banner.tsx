import { memo } from 'react'
import type { OpenPosition } from '@/schemas/trade'
import { REGIME_DEFINITIONS } from '@/schemas/regime'
import { cn } from '@/lib/utils'

interface PositionBannerProps {
  position: OpenPosition | null
  currentPrice: number
}

export const PositionBanner = memo(function PositionBanner({
  position,
  currentPrice,
}: PositionBannerProps) {
  if (!position) {
    return (
      <div className="flex items-center gap-3 rounded-[8px] border border-[rgba(113,112,255,0.15)] bg-[rgba(113,112,255,0.04)] p-3">
        <span className="text-[20px] font-[590] text-cycle-trough">FLAT</span>
        <span className="flex-1 text-[13px] font-[400] text-[#8a8f98]">No open position. Waiting for entry signal.</span>
        <span className="text-[20px] font-[510] text-[#62666d]">—</span>
      </div>
    )
  }

  const pnl = ((currentPrice - position.entryPrice) / position.entryPrice) * position.direction
  const pnlPct = (pnl * position.sizeUsd / position.entryEquity) * 100
  const isLong = position.direction === 1
  const regime = REGIME_DEFINITIONS[position.regimeId]

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[8px] border p-3 transition-colors',
        isLong ? 'border-[rgba(113,112,255,0.3)] bg-[rgba(113,112,255,0.06)]' : 'border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)]',
      )}
    >
      <span className={cn('text-[20px] font-[590]', isLong ? 'text-cycle-rising' : 'text-cycle-falling')}>
        {isLong ? 'LONG' : 'SHORT'}
      </span>
      <span className="flex-1 text-[13px] font-[400] text-[#8a8f98]">
        entry ${position.entryPrice.toFixed(1)} &middot; stop {(position.stop * 100).toFixed(2)}%
        {regime && <> &middot; regime {regime.name}</>}
      </span>
      <span className={cn('text-[20px] font-[510]', pnlPct >= 0 ? 'text-cycle-rising' : 'text-cycle-falling')}>
        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
      </span>
    </div>
  )
})
