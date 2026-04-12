import { memo } from 'react'
import type { ClosedTrade } from '@/schemas/trade'
import { REGIME_DEFINITIONS } from '@/schemas/regime'
import { cn } from '@/lib/utils'

interface TradeListProps {
  trades: ClosedTrade[]
  limit?: number
}

export const TradeList = memo(function TradeList({ trades, limit = 8 }: TradeListProps) {
  const recent = trades.slice(-limit).reverse()

  if (recent.length === 0) {
    return (
      <div className="py-2 text-[13px] font-[400] text-[#62666d]">No closed trades yet.</div>
    )
  }

  return (
    <div>
      {recent.map((trade, idx) => {
        const regime = REGIME_DEFINITIONS[trade.regimeId]
        const isProfit = trade.returnPct >= 0
        return (
          <div
            key={`${trade.timestamp}-${idx}`}
            className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.05)] py-1.5 text-[12px] font-[510] last:border-none"
          >
            <span className={cn('w-8 flex-shrink-0', trade.direction === 1 ? 'text-cycle-rising' : 'text-cycle-falling')}>
              {trade.direction === 1 ? 'L' : 'S'}
            </span>
            <span className="flex-1 font-[400] text-[#8a8f98]">
              {regime?.icon} {regime?.name} &middot; {trade.reason} &middot; {trade.bars}b
            </span>
            <span className={cn('min-w-[60px] text-right', isProfit ? 'text-cycle-rising' : 'text-cycle-falling')}>
              {isProfit ? '+' : ''}{trade.returnPct.toFixed(2)}%
            </span>
            <span className="min-w-[50px] text-right font-[400] text-[#62666d]">
              ${trade.exitPrice.toFixed(0)}
            </span>
          </div>
        )
      })}
    </div>
  )
})
