import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LwLineChart, type LwLinePoint } from '@/components/charts/lw-line-chart'
import { RegimeGrid } from '@/components/panels/regime-grid'
import { usePortfolioStore } from '@/stores/portfolio.store'

export function AnalyticsPage() {
  const equityCurve = usePortfolioStore((s) => s.equityCurve)
  const initialEquity = usePortfolioStore((s) => s.initialEquity)
  const trades = usePortfolioStore((s) => s.trades)

  const equityData = useMemo<LwLinePoint[]>(() => {
    if (equityCurve.length < 2) return []
    const base = Math.floor(Date.now() / 1000) - equityCurve.length
    return equityCurve.map((v, i) => ({ time: base + i, value: v }))
  }, [equityCurve])

  const winRateData = useMemo<LwLinePoint[]>(() => {
    if (trades.length === 0) return []
    let wins = 0
    return trades.map((t, i) => {
      if (t.returnPct > 0) wins++
      return {
        time: Math.floor(t.timestamp / 1000),
        value: (wins / (i + 1)) * 100,
      }
    })
  }, [trades])

  const sharpeData = useMemo<LwLinePoint[]>(() => {
    if (trades.length < 5) return []
    const pts: LwLinePoint[] = []
    const rets: number[] = []
    for (const t of trades) {
      rets.push(t.returnPct)
      if (rets.length < 5) continue
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length
      const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length) || 1
      pts.push({
        time: Math.floor(t.timestamp / 1000),
        value: (mean / sd) * Math.sqrt(rets.length),
      })
    }
    return pts
  }, [trades])

  const equityColor = equityCurve.length > 1 && equityCurve[equityCurve.length - 1]! >= initialEquity
    ? '#7170ff'
    : '#8a8f98'

  return (
    <div className="space-y-3">
      <MetricCard label="Total Trades" value={String(trades.length)} />

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <CardTitle>Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            {equityData.length > 1 ? (
              <LwLineChart
                data={equityData}
                height={200}
                lineColor={equityColor}
                formatValue={(v) => `$${v.toFixed(0)}`}
              />
            ) : (
              <ChartPlaceholder text="Waiting for data…" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {winRateData.length > 1 ? (
              <LwLineChart
                data={winRateData}
                height={200}
                lineColor="#7170ff"
                formatValue={(v) => `${v.toFixed(1)}%`}
              />
            ) : (
              <ChartPlaceholder text="Waiting for trades…" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sharpe Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            {sharpeData.length > 1 ? (
              <LwLineChart
                data={sharpeData}
                height={200}
                lineColor="#7170ff"
                formatValue={(v) => v.toFixed(2)}
              />
            ) : (
              <ChartPlaceholder text="Need ≥5 trades…" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regime Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <RegimeGrid trades={trades} currentRegimeId={null} gpStates={[]} />
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] font-[510] uppercase tracking-[0.05em] text-[#62666d]">{label}</div>
        <div className="mt-1 text-[32px] font-[510] tracking-[-0.704px] text-[#f7f8f8]">{value}</div>
      </CardContent>
    </Card>
  )
}

function ChartPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-[11px] text-[#62666d]">
      {text}
    </div>
  )
}
