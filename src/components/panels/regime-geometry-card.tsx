import { memo, useMemo } from 'react'
import { PolarRoseChart } from '@/components/charts/polar-rose-chart'
import { REGIME_DEFINITIONS } from '@/schemas/regime'
import type { PhaseKappaEntry } from '@/stores/geometry.store'

interface RegimeGeometryCardProps {
  regimeId: number
  history: PhaseKappaEntry[]
  maxKappa: number
  isActive: boolean
}

export const RegimeGeometryCard = memo(function RegimeGeometryCard({
  regimeId,
  history,
  maxKappa,
  isActive,
}: RegimeGeometryCardProps) {
  const def = REGIME_DEFINITIONS[regimeId]!

  const filtered = useMemo(
    () => history.filter((e) => e.regimeId === regimeId),
    [history, regimeId],
  )

  const avgKappa = filtered.length > 0
    ? filtered.reduce((s, e) => s + e.kappa, 0) / filtered.length
    : 0

  const dwellTimes = useMemo(() => {
    const runs: number[] = []
    let cur = 0
    for (const e of history) {
      if (e.regimeId === regimeId) {
        cur++
      } else if (cur > 0) {
        runs.push(cur)
        cur = 0
      }
    }
    if (cur > 0) runs.push(cur)
    return runs
  }, [history, regimeId])

  const avgDwell = dwellTimes.length > 0
    ? dwellTimes.reduce((s, d) => s + d, 0) / dwellTimes.length
    : 0

  const pctOfTotal = history.length > 0
    ? (filtered.length / history.length) * 100
    : 0

  return (
    <div
      className={`rounded-[8px] border bg-[#0f1011] p-3 transition-colors ${
        isActive
          ? 'border-[rgba(113,112,255,0.4)] bg-[rgba(113,112,255,0.04)]'
          : 'border-[rgba(255,255,255,0.05)]'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: def.color }}
        />
        <span className="text-[11px] font-[590] tracking-[0.04em] text-[#d0d6e0]">
          {def.name}
        </span>
        {isActive && (
          <span className="ml-auto text-[9px] font-[510] uppercase tracking-wider text-cycle-rising">
            active
          </span>
        )}
      </div>

      <PolarRoseChart pts={filtered} color={def.color} maxKappa={maxKappa} />

      <div className="mt-2 grid grid-cols-3 gap-1">
        <MetricCell label="Points" value={`${filtered.length}`} />
        <MetricCell label="Avg \u03BA" value={avgKappa > 0 ? avgKappa.toFixed(1) : '\u2014'} />
        <MetricCell label="Share" value={pctOfTotal > 0 ? `${pctOfTotal.toFixed(0)}%` : '\u2014'} />
      </div>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <MetricCell label="Visits" value={`${dwellTimes.length}`} />
        <MetricCell
          label="Avg dwell"
          value={avgDwell > 0 ? `${avgDwell.toFixed(1)} bars` : '\u2014'}
        />
      </div>
    </div>
  )
})

function MetricCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-[4px] border border-[rgba(255,255,255,0.04)] bg-[#08090a] px-2 py-1 text-center">
      <div className="text-[8px] font-[510] uppercase tracking-[0.06em] text-[#62666d]">{label}</div>
      <div className={`mt-0.5 font-mono text-[11px] font-[510] ${color ?? 'text-[#d0d6e0]'}`}>{value}</div>
    </div>
  )
}
