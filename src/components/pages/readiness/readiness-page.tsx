import { useMemo } from 'react'
import { useCrsReadinessStore } from '@/stores/crs-readiness.store'
import { usePortfolioStore } from '@/stores/portfolio.store'
import { usePriceStore } from '@/stores/price.store'
import { REGIME_DEFINITIONS } from '@/schemas/regime'
import { PositionBanner } from '@/components/panels/position-banner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CrsSnapshotData } from '@/workers/dsp.messages'

const PHASE_NAMES = ['RISING', 'PEAK', 'FALLING', 'TROUGH'] as const

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function readinessColor(v: number): string {
  if (v >= 0.7) return 'text-[#50dd80]'
  if (v >= 0.4) return 'text-[#ffaa33]'
  return 'text-[#ff5050]'
}

function readinessBg(v: number): string {
  if (v >= 0.7) return 'bg-[rgba(80,221,128,0.08)]'
  if (v >= 0.4) return 'bg-[rgba(255,170,51,0.06)]'
  return 'bg-[rgba(255,80,80,0.06)]'
}

function boolCell(v: boolean) {
  return v
    ? <span className="text-[#50dd80] font-[590]">YES</span>
    : <span className="text-[#ff5050] font-[590]">NO</span>
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function LatestSummary({ snap }: { snap: CrsSnapshotData }) {
  const regime = REGIME_DEFINITIONS[snap.regimeId]
  const phaseName = PHASE_NAMES[snap.phase] ?? '?'

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
      <SummaryCard label="CRS Composite" value={pct(snap.composite)} sub={`Threshold: ${pct(snap.threshold)}`}
        color={snap.composite >= snap.threshold ? '#50dd80' : '#ff5050'} />
      <SummaryCard label="Coherence" value={pct(snap.coherenceGroup)} color={groupColor(snap.coherenceGroup)} />
      <SummaryCard label="Regime" value={pct(snap.regimeGroup)}
        sub={`${regime?.icon ?? ''} ${regime?.name ?? ''}`} color={groupColor(snap.regimeGroup)} />
      <SummaryCard label="Topology" value={pct(snap.topologyGroup)} color={groupColor(snap.topologyGroup)} />
      <SummaryCard label="Geometry" value={pct(snap.geometryGroup)} color={groupColor(snap.geometryGroup)} />
      <SummaryCard label="Trend" value={pct(snap.trendGroup)}
        sub={`H=${snap.hurst.toFixed(3)} · ${phaseName}`} color={groupColor(snap.trendGroup)} />
    </div>
  )
}

function groupColor(v: number): string {
  if (v >= 0.7) return '#50dd80'
  if (v >= 0.4) return '#ffaa33'
  return '#ff5050'
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-[#0f1011] p-3">
      <div className="text-[10px] font-[510] uppercase tracking-[0.05em] text-[#62666d]">{label}</div>
      <div className="mt-1 font-mono text-[20px] font-[590]" style={{ color }}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-[#8a8f98]">{sub}</div>}
    </div>
  )
}

const COLUMNS: { key: string; label: string; width?: number }[] = [
  { key: 'time', label: 'Time' },
  { key: 'price', label: 'Price' },
  { key: 'regime', label: 'Regime' },
  { key: 'dir', label: 'Dir' },
  { key: 'composite', label: 'CRS' },
  { key: 'coherence', label: 'Coher.' },
  { key: 'regime_g', label: 'Regime' },
  { key: 'topology', label: 'Topo.' },
  { key: 'geometry', label: 'Geom.' },
  { key: 'trend', label: 'Trend' },
  { key: 'kappa', label: 'κ' },
  { key: 'ppc', label: 'PPC' },
  { key: 'hurst', label: 'Hurst' },
  { key: 'topoScore', label: 'T.Score' },
  { key: 'recurrence', label: 'Recurr.' },
  { key: 'structure', label: 'Struct.' },
  { key: 'curvConc', label: 'CurvC' },
  { key: 'h1Peak', label: 'H1' },
  { key: 'dirOk', label: 'Dir✓' },
  { key: 'accelOk', label: 'Acc✓' },
  { key: 'cooldown', label: 'Cool' },
  { key: 'entered', label: 'Entry' },
]

function SnapshotRow({ snap }: { snap: CrsSnapshotData }) {
  const regime = REGIME_DEFINITIONS[snap.regimeId]
  const isEntry = snap.entered

  return (
    <tr className={cn(
      'border-b border-[rgba(255,255,255,0.05)] last:border-none',
      isEntry ? 'bg-[rgba(80,221,128,0.08)]' : 'hover:bg-[rgba(255,255,255,0.02)]',
    )}>
      <td className="px-1.5 py-1 text-[#8a8f98]">{formatTime(snap.timestamp)}</td>
      <td className="px-1.5 py-1 font-mono text-[#d0d6e0]">${snap.price.toFixed(0)}</td>
      <td className="px-1.5 py-1 text-[#d0d6e0]">{regime?.icon} {regime?.name}</td>
      <td className={cn('px-1.5 py-1 font-[590]', snap.direction === 1 ? 'text-cycle-rising' : 'text-cycle-falling')}>
        {snap.direction === 1 ? 'L' : 'S'}
      </td>
      <td className={cn('px-1.5 py-1 font-mono font-[590]', readinessBg(snap.composite), readinessColor(snap.composite))}>
        {pct(snap.composite)}
      </td>
      <td className={cn('px-1.5 py-1 font-mono', readinessColor(snap.coherenceGroup))}>{pct(snap.coherenceGroup)}</td>
      <td className={cn('px-1.5 py-1 font-mono', readinessColor(snap.regimeGroup))}>{pct(snap.regimeGroup)}</td>
      <td className={cn('px-1.5 py-1 font-mono', readinessColor(snap.topologyGroup))}>{pct(snap.topologyGroup)}</td>
      <td className={cn('px-1.5 py-1 font-mono', readinessColor(snap.geometryGroup))}>{pct(snap.geometryGroup)}</td>
      <td className={cn('px-1.5 py-1 font-mono', readinessColor(snap.trendGroup))}>{pct(snap.trendGroup)}</td>
      <td className="px-1.5 py-1 font-mono text-[#d0d6e0]">{snap.kappa.toFixed(2)}</td>
      <td className="px-1.5 py-1 font-mono text-[#d0d6e0]">{pct(snap.ppc)}</td>
      <td className="px-1.5 py-1 font-mono text-[#d0d6e0]">{snap.hurst.toFixed(3)}</td>
      <td className="px-1.5 py-1 font-mono text-[#d0d6e0]">{pct(snap.topologyScore)}</td>
      <td className="px-1.5 py-1 font-mono text-[#d0d6e0]">{pct(snap.recurrenceRate)}</td>
      <td className="px-1.5 py-1 font-mono text-[#d0d6e0]">{pct(snap.structureScore)}</td>
      <td className="px-1.5 py-1 font-mono text-[#d0d6e0]">{snap.curvatureConcentration.toFixed(2)}</td>
      <td className="px-1.5 py-1 font-mono text-[#d0d6e0]">{snap.h1Peak.toFixed(3)}</td>
      <td className="px-1.5 py-1 text-center">{boolCell(snap.directionMatch)}</td>
      <td className="px-1.5 py-1 text-center">{boolCell(snap.accelMatch)}</td>
      <td className="px-1.5 py-1 text-center">{boolCell(!snap.cooldownActive)}</td>
      <td className="px-1.5 py-1 text-center">
        {snap.entered
          ? <span className="rounded bg-[rgba(80,221,128,0.15)] px-1.5 py-0.5 text-[10px] font-[590] text-[#50dd80]">TRADE</span>
          : <span className="text-[#62666d]">—</span>}
      </td>
    </tr>
  )
}

export function ReadinessPage() {
  const snapshots = useCrsReadinessStore((s) => s.snapshots)
  const reversed = useMemo(() => [...snapshots].reverse(), [snapshots])
  const latest = reversed[0]

  const equity = usePortfolioStore((s) => s.equity)
  const initialEquity = usePortfolioStore((s) => s.initialEquity)
  const position = usePortfolioStore((s) => s.position)
  const trades = usePortfolioStore((s) => s.trades)
  const latestPrice = usePriceStore((s) => s.latestPrice)

  const unrealisedPnl = position && latestPrice
    ? ((latestPrice - position.entryPrice) / position.entryPrice) * position.direction * position.sizeUsd
    : 0
  const totalReturn = ((equity + unrealisedPnl - initialEquity) / initialEquity) * 100

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[14px] font-[590] text-[#f7f8f8]">
          Trade Readiness
          <span className="ml-2 text-[11px] font-normal text-[#62666d]">
            Composite Readiness Score · per bar · {snapshots.length} snapshots
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
        <PositionBanner position={position} currentPrice={latestPrice ?? 0} />
        <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-[#0f1011] px-4 py-3">
          <div className="text-[10px] font-[510] uppercase tracking-[0.05em] text-[#62666d]">Equity</div>
          <div className="mt-1 font-mono text-[18px] font-[590] text-[#f7f8f8]">${equity.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-[#0f1011] px-4 py-3">
          <div className="text-[10px] font-[510] uppercase tracking-[0.05em] text-[#62666d]">Unrealised P&L</div>
          <div className={cn('mt-1 font-mono text-[18px] font-[590]', unrealisedPnl >= 0 ? 'text-[#50dd80]' : 'text-[#ff5050]')}>
            {unrealisedPnl >= 0 ? '+' : ''}{unrealisedPnl.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-[#0f1011] px-4 py-3">
          <div className="text-[10px] font-[510] uppercase tracking-[0.05em] text-[#62666d]">Total Return</div>
          <div className={cn('mt-1 font-mono text-[18px] font-[590]', totalReturn >= 0 ? 'text-[#50dd80]' : 'text-[#ff5050]')}>
            {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </div>
          <div className="mt-0.5 text-[10px] text-[#8a8f98]">{trades.length} trades</div>
        </div>
      </div>

      {latest && <LatestSummary snap={latest} />}

      <Card>
        <CardHeader>
          <CardTitle>
            CRS History
            <span className="ml-2 text-[11px] font-normal text-[#62666d]">
              latest first · green = above threshold · highlighted rows = trade entered
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reversed.length === 0 ? (
            <div className="py-8 text-center text-[14px] text-[#62666d]">
              Waiting for data — CRS snapshots appear once the pipeline exits bootstrap.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr>
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="whitespace-nowrap border-b border-[rgba(255,255,255,0.05)] px-1.5 py-2 text-left text-[9px] font-[510] uppercase tracking-[0.05em] text-[#62666d]">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reversed.map((snap, i) => (
                    <SnapshotRow key={snap.timestamp + '-' + i} snap={snap} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
