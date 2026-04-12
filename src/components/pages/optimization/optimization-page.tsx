import { memo, useMemo, useState } from 'react'
import { usePortfolioStore } from '@/stores/portfolio.store'
import { TRADING_CONFIG } from '@/config/trading'
import { REGIME_DEFINITIONS } from '@/schemas/regime'
import type { RegimeId } from '@/schemas/regime'
import type { GpState } from '@/schemas/portfolio'
import type { ClosedTrade } from '@/schemas/trade'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

function decodeParam(normalised: number, paramIdx: number): number {
  const bounds = TRADING_CONFIG.paramBounds[paramIdx]!
  return bounds[0] + normalised * (bounds[1] - bounds[0])
}

function formatParam(value: number, name: string): string {
  if (name === 'reentry_bars') return Math.round(value).toString()
  if (name === 'min_confidence') return (value * 100).toFixed(0) + '%'
  if (name === 'entry_thr' || name === 'stop' || name === 'size' || name === 'exit_ph')
    return (value * 100).toFixed(2) + '%'
  return value.toFixed(4)
}

const PARAM_LABELS: Record<string, string> = {
  entry_thr: 'Entry Threshold',
  size: 'Position Size',
  stop: 'Stop Loss',
  exit_ph: 'Exit Phase',
  reentry_bars: 'Re-entry Cooldown',
  min_confidence: 'Min Confidence',
}

export function OptimizationPage() {
  const gpStates = usePortfolioStore((s) => s.gpStates)
  const trades = usePortfolioStore((s) => s.trades)
  const currentRegimeId = usePortfolioStore((s) => s.currentRegimeId)
  const position = usePortfolioStore((s) => s.position)
  const barCount = usePortfolioStore((s) => s.barCount)
  const reentryCooldowns = usePortfolioStore((s) => s.reentryCooldowns)

  const totalObservations = useMemo(
    () => gpStates.reduce((sum, gp) => sum + gp.inputs.length, 0),
    [gpStates],
  )

  const currentBeta = useMemo(() => {
    if (currentRegimeId === null) return TRADING_CONFIG.ucb.baseBeta
    const gp = gpStates[currentRegimeId]
    if (!gp) return TRADING_CONFIG.ucb.baseBeta
    return Math.max(
      TRADING_CONFIG.ucb.minBeta,
      TRADING_CONFIG.ucb.baseBeta - gp.inputs.length * TRADING_CONFIG.ucb.betaDecayRate,
    )
  }, [gpStates, currentRegimeId])

  const explorationPct = useMemo(() => {
    const range = TRADING_CONFIG.ucb.baseBeta - TRADING_CONFIG.ucb.minBeta
    return ((currentBeta - TRADING_CONFIG.ucb.minBeta) / range) * 100
  }, [currentBeta])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h1 className="text-[13px] font-[510] uppercase tracking-[0.05em] text-[#8a8f98]">
          Trade Engine Optimization
        </h1>
        <Badge variant="live">LIVE</Badge>
        {barCount > 0 && (
          <span className="text-[11px] font-[400] text-[#62666d]">
            {barCount} bars processed
          </span>
        )}
      </div>

      <OverviewCards
        totalObservations={totalObservations}
        currentRegimeId={currentRegimeId}
        explorationPct={explorationPct}
        currentBeta={currentBeta}
        gpStates={gpStates}
      />

      <ActiveParamsCard position={position} trades={trades} />

      <Tabs defaultValue="regimes">
        <TabsList className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]">
          <TabsTrigger value="regimes" className="text-[11px] data-[state=active]:bg-[rgba(113,112,255,0.12)] data-[state=active]:text-accent">
            Per-Regime GP
          </TabsTrigger>
          <TabsTrigger value="observations" className="text-[11px] data-[state=active]:bg-[rgba(113,112,255,0.12)] data-[state=active]:text-accent">
            Observation Log
          </TabsTrigger>
          <TabsTrigger value="convergence" className="text-[11px] data-[state=active]:bg-[rgba(113,112,255,0.12)] data-[state=active]:text-accent">
            Convergence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regimes">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {REGIME_DEFINITIONS.map((regime) => (
              <RegimeGpCard
                key={regime.id}
                regimeId={regime.id}
                gp={gpStates[regime.id]!}
                trades={trades}
                isActive={regime.id === currentRegimeId}
                cooldown={reentryCooldowns[regime.id] ?? 0}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="observations">
          <ObservationLog gpStates={gpStates} />
        </TabsContent>

        <TabsContent value="convergence">
          <ConvergencePanel gpStates={gpStates} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview cards
// ---------------------------------------------------------------------------

interface OverviewCardsProps {
  totalObservations: number
  currentRegimeId: RegimeId | null
  explorationPct: number
  currentBeta: number
  gpStates: GpState[]
}

const OverviewCards = memo(function OverviewCards({
  totalObservations,
  currentRegimeId,
  explorationPct,
  currentBeta,
  gpStates,
}: OverviewCardsProps) {
  const regime = currentRegimeId !== null ? REGIME_DEFINITIONS[currentRegimeId] : null
  const regimesWithData = gpStates.filter((gp) => gp.inputs.length > 0).length

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <MetricCard label="Total GP Observations" value={totalObservations.toString()} sub={`across ${regimesWithData}/8 regimes`} />
      <MetricCard
        label="Active Regime"
        value={regime ? regime.name : 'NONE'}
        sub={regime ? `${regime.icon} regime ${currentRegimeId}` : 'waiting for signal'}
        valueColor={regime?.color}
      />
      <MetricCard
        label="UCB Beta"
        value={currentBeta.toFixed(2)}
        sub={`${explorationPct.toFixed(0)}% exploration`}
      />
      <MetricCard
        label="GP Config"
        value={`σ²=${TRADING_CONFIG.gp.noise}`}
        sub={`ℓ=${TRADING_CONFIG.gp.lengthscale} · max=${TRADING_CONFIG.maxGpObservations}`}
      />
    </div>
  )
})

function MetricCard({ label, value, sub, valueColor }: {
  label: string
  value: string
  sub: string
  valueColor?: string
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[10px] font-[510] uppercase tracking-[0.04em] text-[#62666d]">{label}</div>
        <div className="mt-0.5 text-[20px] font-[510] tracking-tight" style={valueColor ? { color: valueColor } : undefined}>
          {value}
        </div>
        <div className="mt-0.5 text-[10px] font-[400] text-[#62666d]">{sub}</div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Active position params
// ---------------------------------------------------------------------------

const ActiveParamsCard = memo(function ActiveParamsCard({
  position,
  trades,
}: {
  position: ReturnType<typeof usePortfolioStore.getState>['position']
  trades: ClosedTrade[]
}) {
  const lastTrade = trades.length > 0 ? trades[trades.length - 1]! : null
  const isActive = !!position
  const paramVector = position?.paramVector ?? lastTrade?.paramVector ?? null
  const regimeId = position?.regimeId ?? lastTrade?.regimeId ?? null
  const direction = position?.direction ?? lastTrade?.direction ?? null

  if (!paramVector || regimeId === null || direction === null) return null

  const regime = REGIME_DEFINITIONS[regimeId]
  const decoded = paramVector.map((v, i) => decodeParam(v, i))

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2">
          {isActive ? 'Active' : 'Latest'} Trade Parameters
          {isActive ? (
            <Badge variant="rising">{direction === 1 ? 'LONG' : 'SHORT'}</Badge>
          ) : (
            <Badge variant="outline">{direction === 1 ? 'LONG' : 'SHORT'}</Badge>
          )}
          <span className="text-[10px] font-[400] text-[#62666d]">
            {regime?.icon} {regime?.name}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {TRADING_CONFIG.paramNames.map((name, i) => {
            const norm = paramVector[i]!
            const val = decoded[i]!
            const bounds = TRADING_CONFIG.paramBounds[i]!
            const pctInRange = ((val - bounds[0]) / (bounds[1] - bounds[0])) * 100

            return (
              <div key={name} className="rounded-[8px] border border-[rgba(255,255,255,0.05)] bg-[#08090a] p-2.5">
                <div className="text-[10px] font-[510] uppercase tracking-[0.04em] text-[#62666d]">
                  {PARAM_LABELS[name] ?? name}
                </div>
                <div className="mt-1 text-[16px] font-[510] text-accent">
                  {formatParam(val, name)}
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300"
                    style={{ width: `${pctInRange}%` }}
                  />
                </div>
                <div className="mt-0.5 flex justify-between text-[9px] text-[#62666d]">
                  <span>{formatParam(bounds[0], name)}</span>
                  <span className="text-[#8a8f98]">n={norm.toFixed(2)}</span>
                  <span>{formatParam(bounds[1], name)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})

// ---------------------------------------------------------------------------
// Per-regime GP cards
// ---------------------------------------------------------------------------

interface RegimeGpCardProps {
  regimeId: RegimeId
  gp: GpState
  trades: ClosedTrade[]
  isActive: boolean
  cooldown: number
}

const RegimeGpCard = memo(function RegimeGpCard({
  regimeId,
  gp,
  trades: _trades,
  isActive,
  cooldown,
}: RegimeGpCardProps) {
  const regime = REGIME_DEFINITIONS[regimeId]!
  const obsCount = gp.inputs.length
  const gpFillPct = Math.min((obsCount / TRADING_CONFIG.maxGpObservations) * 100, 100)

  const beta = Math.max(
    TRADING_CONFIG.ucb.minBeta,
    TRADING_CONFIG.ucb.baseBeta - obsCount * TRADING_CONFIG.ucb.betaDecayRate,
  )

  const bestReward = useMemo(() => {
    if (gp.outputs.length === 0) return null
    return Math.max(...gp.outputs)
  }, [gp.outputs])

  const worstReward = useMemo(() => {
    if (gp.outputs.length === 0) return null
    return Math.min(...gp.outputs)
  }, [gp.outputs])

  const avgReward = useMemo(() => {
    if (gp.outputs.length === 0) return null
    return gp.outputs.reduce((a, b) => a + b, 0) / gp.outputs.length
  }, [gp.outputs])

  const latestParams = useMemo(() => {
    if (gp.inputs.length === 0) return null
    const latest = gp.inputs[gp.inputs.length - 1]!
    return latest.map((v, i) => decodeParam(v, i))
  }, [gp.inputs])

  return (
    <Card className={cn(isActive && 'border-[rgba(113,112,255,0.4)]')}>
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2">
          <span style={{ color: regime.color }}>{regime.icon} {regime.name}</span>
          {isActive && <Badge variant="live">ACTIVE</Badge>}
          {cooldown > 0 && (
            <Badge variant="outline">cooldown {cooldown}b</Badge>
          )}
          <span className="ml-auto text-[10px] font-[400] text-[#62666d]">
            β={beta.toFixed(2)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-2">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-[510] text-[#62666d]">GP FILL</div>
          <div className="flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${gpFillPct}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] font-[510] text-[#8a8f98]">
            {obsCount}/{TRADING_CONFIG.maxGpObservations}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <MiniStat label="Obs" value={obsCount.toString()} />
          <MiniStat
            label="Best"
            value={bestReward !== null ? `${bestReward >= 0 ? '+' : ''}${bestReward.toFixed(3)}` : '—'}
            color={bestReward !== null && bestReward >= 0 ? 'text-cycle-rising' : 'text-cycle-falling'}
          />
          <MiniStat
            label="Worst"
            value={worstReward !== null ? `${worstReward >= 0 ? '+' : ''}${worstReward.toFixed(3)}` : '—'}
            color={worstReward !== null && worstReward >= 0 ? 'text-cycle-rising' : 'text-cycle-falling'}
          />
          <MiniStat
            label="Avg"
            value={avgReward !== null ? `${avgReward >= 0 ? '+' : ''}${avgReward.toFixed(3)}` : '—'}
            color={avgReward !== null && avgReward >= 0 ? 'text-cycle-rising' : 'text-cycle-falling'}
          />
        </div>

        {latestParams && (
          <div>
            <div className="mb-1 text-[10px] font-[510] uppercase tracking-[0.04em] text-[#62666d]">
              Latest Learned Params
            </div>
            <div className="grid grid-cols-3 gap-1 md:grid-cols-6">
              {TRADING_CONFIG.paramNames.map((name, i) => (
                <div key={name} className="rounded-[4px] bg-[rgba(255,255,255,0.03)] px-1.5 py-1 text-center">
                  <div className="text-[8px] font-[510] uppercase text-[#62666d]">{name}</div>
                  <div className="text-[11px] font-[510] text-[#d0d6e0]">
                    {formatParam(latestParams[i]!, name)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {obsCount === 0 && (
          <div className="py-1 text-[11px] font-[400] text-[#62666d]">
            No observations yet — GP is purely exploring with random candidates.
          </div>
        )}
      </CardContent>
    </Card>
  )
})

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-[6px] border border-[rgba(255,255,255,0.05)] bg-[#08090a] p-1.5 text-center">
      <div className="text-[8px] font-[510] uppercase tracking-[0.04em] text-[#62666d]">{label}</div>
      <div className={cn('text-[12px] font-[510]', color ?? 'text-[#f7f8f8]')}>{value}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Observation log
// ---------------------------------------------------------------------------

interface ObservationLogProps {
  gpStates: GpState[]
}

const PAGE_SIZE = 10

const ObservationLog = memo(function ObservationLog({ gpStates }: ObservationLogProps) {
  const [page, setPage] = useState(0)

  const allObservations = useMemo(() => {
    const obs: { regimeId: number; paramVector: number[]; reward: number; obsIdx: number }[] = []
    gpStates.forEach((gp, regimeId) => {
      gp.inputs.forEach((input, idx) => {
        obs.push({
          regimeId,
          paramVector: input,
          reward: gp.outputs[idx]!,
          obsIdx: idx,
        })
      })
    })
    return obs.reverse()
  }, [gpStates])

  const totalPages = Math.max(1, Math.ceil(allObservations.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = allObservations.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  if (allObservations.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="py-6 text-center text-[13px] text-[#62666d]">
            No GP observations yet. Trades need to close before the engine learns from them.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.05)] text-[10px] font-[510] uppercase tracking-[0.04em] text-[#62666d]">
                <th className="px-3 py-2 text-left">Regime</th>
                <th className="px-3 py-2 text-left">#</th>
                {TRADING_CONFIG.paramNames.map((name) => (
                  <th key={name} className="px-3 py-2 text-right">{name}</th>
                ))}
                <th className="px-3 py-2 text-right">Reward</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((obs, idx) => {
                const regime = REGIME_DEFINITIONS[obs.regimeId]!
                const isPositive = obs.reward >= 0
                return (
                  <tr
                    key={`${obs.regimeId}-${obs.obsIdx}-${idx}`}
                    className="border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.02)]"
                  >
                    <td className="px-3 py-1.5">
                      <span style={{ color: regime.color }}>{regime.icon} {regime.name}</span>
                    </td>
                    <td className="px-3 py-1.5 text-[#62666d]">{obs.obsIdx + 1}</td>
                    {obs.paramVector.map((v, i) => (
                      <td key={i} className="px-3 py-1.5 text-right font-mono text-[#d0d6e0]">
                        {formatParam(decodeParam(v, i), TRADING_CONFIG.paramNames[i]!)}
                      </td>
                    ))}
                    <td className={cn('px-3 py-1.5 text-right font-[590]', isPositive ? 'text-cycle-rising' : 'text-cycle-falling')}>
                      {isPositive ? '+' : ''}{obs.reward.toFixed(3)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.05)] px-3 py-2">
            <span className="text-[10px] text-[#62666d]">
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, allObservations.length)} of {allObservations.length}
            </span>
            <div className="flex gap-1">
              <PaginationButton
                label="«"
                onClick={() => setPage(0)}
                disabled={safePage === 0}
              />
              <PaginationButton
                label="‹"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
              />
              <span className="flex items-center px-2 text-[10px] font-[510] text-[#8a8f98]">
                {safePage + 1} / {totalPages}
              </span>
              <PaginationButton
                label="›"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
              />
              <PaginationButton
                label="»"
                onClick={() => setPage(totalPages - 1)}
                disabled={safePage >= totalPages - 1}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

function PaginationButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-[4px] text-[11px] font-[590] transition-colors',
        disabled
          ? 'cursor-default text-[#34343a]'
          : 'text-[#8a8f98] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f8f8]',
      )}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Convergence panel
// ---------------------------------------------------------------------------

interface ConvergencePanelProps {
  gpStates: GpState[]
}

const ConvergencePanel = memo(function ConvergencePanel({ gpStates }: ConvergencePanelProps) {
  return (
    <div className="space-y-2">
      <Card>
        <CardHeader>
          <CardTitle>GP Convergence by Regime</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {REGIME_DEFINITIONS.map((regime) => {
              const gp = gpStates[regime.id]!
              return (
                <RegimeConvergenceRow
                  key={regime.id}
                  regime={regime}
                  gp={gp}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hyperparameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <HyperparamBox label="GP Noise (σ²)" value={TRADING_CONFIG.gp.noise.toString()} />
            <HyperparamBox label="GP Lengthscale (ℓ)" value={TRADING_CONFIG.gp.lengthscale.toString()} />
            <HyperparamBox label="Max Observations" value={TRADING_CONFIG.maxGpObservations.toString()} />
            <HyperparamBox label="UCB Base Beta" value={TRADING_CONFIG.ucb.baseBeta.toString()} />
            <HyperparamBox label="UCB Beta Decay" value={TRADING_CONFIG.ucb.betaDecayRate.toString()} />
            <HyperparamBox label="UCB Min Beta" value={TRADING_CONFIG.ucb.minBeta.toString()} />
            <HyperparamBox label="UCB Candidates" value={TRADING_CONFIG.ucbCandidates.toString()} />
            <HyperparamBox label="Min Hold Frac" value={`${(TRADING_CONFIG.minHoldFraction * 100).toFixed(0)}% of T`} />
            <HyperparamBox label="Kappa Threshold" value={TRADING_CONFIG.kappaThreshold.toString()} />
            <HyperparamBox label="Rw: Return" value={TRADING_CONFIG.rewardWeights.return.toString()} />
            <HyperparamBox label="Rw: Risk" value={TRADING_CONFIG.rewardWeights.risk.toString()} />
            <HyperparamBox label="Rw: Efficiency" value={TRADING_CONFIG.rewardWeights.efficiency.toString()} />
            <HyperparamBox label="Rw: Alignment" value={TRADING_CONFIG.rewardWeights.alignment.toString()} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parameter Bounds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {TRADING_CONFIG.paramNames.map((name, i) => {
              const bounds = TRADING_CONFIG.paramBounds[i]!
              return (
                <div key={name} className="rounded-[8px] border border-[rgba(255,255,255,0.05)] bg-[#08090a] p-2.5 text-center">
                  <div className="text-[10px] font-[510] uppercase tracking-[0.04em] text-[#62666d]">
                    {PARAM_LABELS[name] ?? name}
                  </div>
                  <div className="mt-1 text-[13px] font-[510] text-[#d0d6e0]">
                    {formatParam(bounds[0], name)} — {formatParam(bounds[1], name)}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

function RegimeConvergenceRow({ regime, gp }: {
  regime: (typeof REGIME_DEFINITIONS)[number]
  gp: GpState
}) {
  const obsCount = gp.inputs.length
  const fillPct = Math.min((obsCount / TRADING_CONFIG.maxGpObservations) * 100, 100)
  const beta = Math.max(
    TRADING_CONFIG.ucb.minBeta,
    TRADING_CONFIG.ucb.baseBeta - obsCount * TRADING_CONFIG.ucb.betaDecayRate,
  )
  const betaRange = TRADING_CONFIG.ucb.baseBeta - TRADING_CONFIG.ucb.minBeta
  const exploitPct = ((TRADING_CONFIG.ucb.baseBeta - beta) / betaRange) * 100

  const rewardStdDev = useMemo(() => {
    if (gp.outputs.length < 2) return null
    const mean = gp.outputs.reduce((a, b) => a + b, 0) / gp.outputs.length
    return Math.sqrt(gp.outputs.reduce((a, b) => a + (b - mean) ** 2, 0) / gp.outputs.length)
  }, [gp.outputs])

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-[11px] font-[510]" style={{ color: regime.color }}>
        {regime.icon} {regime.name}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
              <div className="flex h-full">
                <div
                  className="h-full bg-accent transition-[width] duration-300"
                  style={{ width: `${exploitPct}%` }}
                  title="Exploitation"
                />
                <div
                  className="h-full bg-[rgba(113,112,255,0.3)] transition-[width] duration-300"
                  style={{ width: `${Math.max(0, fillPct - exploitPct)}%` }}
                  title="Exploration"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-0.5 flex gap-3 text-[9px] text-[#62666d]">
          <span>{obsCount} obs</span>
          <span>β={beta.toFixed(2)}</span>
          <span>{exploitPct.toFixed(0)}% exploit</span>
          {rewardStdDev !== null && <span>σ_rw={rewardStdDev.toFixed(3)}</span>}
        </div>
      </div>

      <div className="w-16 text-right">
        {obsCount === 0 ? (
          <Badge variant="outline">cold</Badge>
        ) : obsCount < 5 ? (
          <Badge variant="falling">warming</Badge>
        ) : obsCount < 15 ? (
          <Badge variant="peak">learning</Badge>
        ) : (
          <Badge variant="rising">converged</Badge>
        )}
      </div>
    </div>
  )
}

function HyperparamBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[rgba(255,255,255,0.05)] bg-[#08090a] p-2.5">
      <div className="text-[10px] font-[510] uppercase tracking-[0.04em] text-[#62666d]">{label}</div>
      <div className="mt-0.5 text-[16px] font-[510] text-[#f7f8f8]">{value}</div>
    </div>
  )
}
