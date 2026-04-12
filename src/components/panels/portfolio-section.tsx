import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EquityChart } from '@/components/charts/equity-chart'
import { PositionBanner } from '@/components/panels/position-banner'
import { RegimeGrid } from '@/components/panels/regime-grid'
import { TradeList } from '@/components/panels/trade-list'
import { REGIME_DEFINITIONS } from '@/schemas/regime'
import { cn } from '@/lib/utils'
import type { PortfolioState } from './portfolio-section.types'

interface PortfolioSectionProps {
  portfolio: PortfolioState
  latestPrice: number
}

export const PortfolioSection = memo(function PortfolioSection({
  portfolio,
  latestPrice,
}: PortfolioSectionProps) {
  const currentPrice = latestPrice
  const unrealisedPnl = portfolio.position
    ? ((currentPrice - portfolio.position.entryPrice) / portfolio.position.entryPrice) *
      portfolio.position.direction * portfolio.position.sizeUsd
    : 0
  const totalEquity = portfolio.equity + unrealisedPnl
  const totalReturn = ((totalEquity - portfolio.initialEquity) / portfolio.initialEquity) * 100
  const winCount = portfolio.trades.filter((t) => t.returnPct > 0).length
  const winRate = portfolio.trades.length > 0
    ? (winCount / portfolio.trades.length) * 100
    : 0
  const sharpe = computeSharpe(portfolio.returns)
  const isPositiveReturn = totalReturn >= 0

  const regime = portfolio.currentRegimeId !== null
    ? REGIME_DEFINITIONS[portfolio.currentRegimeId]
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulated Portfolio &mdash; Bayesian Self-Learning Engine</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className={cn('text-[32px] font-[510] tracking-[-0.704px]', isPositiveReturn ? 'text-cycle-rising' : 'text-cycle-falling')}>
              ${totalEquity.toFixed(0)}
            </div>
            <div className="text-[13px] font-[400] text-[#8a8f98]">
              equity &middot;{' '}
              <span className={isPositiveReturn ? 'text-cycle-rising' : 'text-cycle-falling'}>
                {isPositiveReturn ? '+' : ''}{totalReturn.toFixed(2)}%
              </span>{' '}
              total return
            </div>
          </div>
          <div className="text-right">
            <div className="text-[16px] font-[510] text-[#f7f8f8]">{portfolio.trades.length > 0 ? `${winRate.toFixed(0)}%` : '—'}</div>
            <div className="text-[10px] font-[510] text-[#62666d]">win rate</div>
          </div>
          <div className="text-right">
            <div className="text-[16px] font-[510] text-[#f7f8f8]">{portfolio.trades.length}</div>
            <div className="text-[10px] font-[510] text-[#62666d]">trades</div>
          </div>
          <div className="text-right">
            <div className="text-[16px] font-[510] text-[#f7f8f8]">{sharpe !== null ? sharpe.toFixed(2) : '—'}</div>
            <div className="text-[10px] font-[510] text-[#62666d]">sharpe</div>
          </div>
        </div>

        <EquityChart curve={portfolio.equityCurve} initialEquity={portfolio.initialEquity} />
        <PositionBanner position={portfolio.position} currentPrice={currentPrice} />

        {regime && (
          <div className="text-[13px] font-[400] text-[#8a8f98]">
            ACTIVE REGIME:{' '}
            <span className="font-[590] text-accent">{regime.name}</span>
          </div>
        )}

        <RegimeGrid
          trades={portfolio.trades}
          currentRegimeId={portfolio.currentRegimeId}
          gpStates={portfolio.gpStates}
        />

        <div className="text-[10px] font-[510] uppercase tracking-[0.05em] text-[#62666d]">Recent Trades</div>
        <TradeList trades={portfolio.trades} />
      </CardContent>
    </Card>
  )
})

function computeSharpe(returns: number[]): number | null {
  if (returns.length < 5) return null
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const sd = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length) || 1
  return (mean / sd) * Math.sqrt(returns.length)
}
