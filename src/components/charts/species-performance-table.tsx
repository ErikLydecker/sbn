import { memo } from 'react'
import type { SpeciesCatalogEntry } from '@/stores/morphology.store'

interface SpeciesPerformanceTableProps {
  catalog: SpeciesCatalogEntry[]
  currentSpecies: number
}

function formatPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function winRate(entry: SpeciesCatalogEntry): number {
  return entry.count > 0 ? entry.wins / entry.count : 0
}

function avgReturn(entry: SpeciesCatalogEntry): number {
  return entry.count > 0 ? entry.totalReturn / entry.count : 0
}

function timeSince(ts: number): string {
  if (ts === 0) return '—'
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  return `${Math.floor(sec / 3600)}h`
}

export const SpeciesPerformanceTable = memo(function SpeciesPerformanceTable({
  catalog,
  currentSpecies,
}: SpeciesPerformanceTableProps) {
  const sorted = [...catalog].sort((a, b) => a.id - b.id)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] font-[510]">
        <thead>
          <tr className="border-b border-[rgba(255,255,255,0.06)] text-[#62666d]">
            <th className="px-2 py-1.5 text-left">Species</th>
            <th className="px-2 py-1.5 text-right">Count</th>
            <th className="px-2 py-1.5 text-right">Avg Return</th>
            <th className="px-2 py-1.5 text-right">Win Rate</th>
            <th className="px-2 py-1.5 text-right">Curv Conc</th>
            <th className="px-2 py-1.5 text-right">H1 Peak</th>
            <th className="px-2 py-1.5 text-right">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-2 py-4 text-center text-[#62666d]">
                Awaiting data...
              </td>
            </tr>
          )}
          {sorted.map((entry) => {
            const isActive = entry.id === currentSpecies
            const ret = avgReturn(entry)
            const wr = winRate(entry)
            const hasTradeData = entry.totalReturn !== 0 || entry.wins > 0
            return (
              <tr
                key={entry.id}
                className={`border-b border-[rgba(255,255,255,0.03)] ${
                  isActive ? 'bg-[rgba(113,112,255,0.08)]' : ''
                }`}
              >
                <td className="px-2 py-1.5 text-left">
                  <span className={isActive ? 'text-[#7170ff]' : 'text-[#d0d6e0]'}>
                    S-{entry.id}
                    {isActive && <span className="ml-1 text-[9px] text-[#7170ff]">●</span>}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-[#8a8f98]">{entry.count}</td>
                <td className={`px-2 py-1.5 text-right ${
                  !hasTradeData ? 'text-[#62666d]'
                    : ret >= 0 ? 'text-[#50dd80]' : 'text-[#ff6b6b]'
                }`}>
                  {hasTradeData ? formatPct(ret) : '—'}
                </td>
                <td className={`px-2 py-1.5 text-right ${
                  !hasTradeData ? 'text-[#62666d]'
                    : wr >= 0.5 ? 'text-[#50dd80]' : 'text-[#ff6b6b]'
                }`}>
                  {hasTradeData ? `${(wr * 100).toFixed(0)}%` : '—'}
                </td>
                <td className="px-2 py-1.5 text-right text-[#8a8f98]">
                  {(entry.avgCurvatureConcentration * 100).toFixed(1)}%
                </td>
                <td className="px-2 py-1.5 text-right text-[#8a8f98]">
                  {entry.avgH1Peak.toFixed(1)}
                </td>
                <td className="px-2 py-1.5 text-right text-[#62666d]">
                  {timeSince(entry.lastSeen)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})
