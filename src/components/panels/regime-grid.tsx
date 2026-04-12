import { memo } from 'react'
import { REGIME_DEFINITIONS } from '@/schemas/regime'
import type { RegimeId } from '@/schemas/regime'
import type { ClosedTrade } from '@/schemas/trade'
import type { GpState } from '@/schemas/portfolio'
import { cn } from '@/lib/utils'

interface RegimeGridProps {
  trades: ClosedTrade[]
  currentRegimeId: RegimeId | null
  gpStates: GpState[]
}

export const RegimeGrid = memo(function RegimeGrid({
  trades,
  currentRegimeId,
  gpStates,
}: RegimeGridProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {REGIME_DEFINITIONS.map((regime) => {
        const regimeTrades = trades.filter((t) => t.regimeId === regime.id)
        const wins = regimeTrades.filter((t) => t.returnPct > 0).length
        const avgRet = regimeTrades.length > 0
          ? regimeTrades.reduce((s, t) => s + t.returnPct, 0) / regimeTrades.length
          : 0
        const gp = gpStates[regime.id]
        const isActive = regime.id === currentRegimeId
        const barPct = gp ? Math.min((gp.inputs.length / 10) * 100, 100) : 0

        return (
          <div
            key={regime.id}
            className={cn(
              'relative overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.05)] bg-[#08090a] p-2.5',
              isActive && 'border-[rgba(113,112,255,0.4)]',
            )}
          >
            <div className="text-[10px] font-[510] uppercase tracking-[0.04em] text-[#62666d]">
              {regime.icon} {regime.name}
            </div>
            <div className="mt-0.5 text-[14px] font-[510]" style={{ color: regime.color }}>
              {regimeTrades.length} trades &middot; {regimeTrades.length > 0 ? `${((wins / regimeTrades.length) * 100).toFixed(0)}%` : '—'} win
            </div>
            <div className="mt-0.5 text-[10px] font-[400] text-[#62666d]">
              {regimeTrades.length > 0
                ? `avgRet=${avgRet >= 0 ? '+' : ''}${avgRet.toFixed(2)}%`
                : 'no trades yet — GP exploring'}
            </div>
            <div
              className="absolute bottom-0 left-0 h-0.5 bg-accent transition-[width] duration-300"
              style={{ width: `${barPct}%` }}
            />
          </div>
        )
      })}
    </div>
  )
})
