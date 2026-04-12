import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RegimeAttractorChart } from '@/components/charts/regime-attractor-chart'
import { TransitionMatrixChart } from '@/components/charts/transition-matrix-chart'
import { RegimeGeometryCard } from '@/components/panels/regime-geometry-card'
import { useGeometryStore } from '@/stores/geometry.store'
import { useAnalysisStore } from '@/stores/analysis.store'
import { REGIME_DEFINITIONS } from '@/schemas/regime'

export function GeometryPage() {
  const history = useGeometryStore((s) => s.history)
  const transitions = useGeometryStore((s) => s.transitions)
  const smooth = useAnalysisStore((s) => s.smooth)

  const activeRegimeId = useMemo(() => {
    if (history.length === 0) return -1
    return history[history.length - 1]!.regimeId
  }, [history])

  const maxKappa = useMemo(() => {
    let mk = 0
    for (const e of history) {
      if (e.kappa > mk) mk = e.kappa
    }
    return mk
  }, [history])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Attractor Trajectory
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">regime-colored &middot; drag to rotate</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RegimeAttractorChart
              pts={smooth?.embeddingVecs ?? []}
              history={history}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Transition Matrix
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">regime &rarr; regime flow counts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TransitionMatrixChart matrix={transitions} />
            <p className="mt-2 text-[10px] font-normal leading-relaxed text-[#62666d]">
              Diagonal = self-transitions (persistence). Off-diagonal = regime changes.
              Bright cells = frequent transitions.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Per-Regime Polar Roses
            <span className="ml-2 text-[11px] font-normal text-[#62666d]">
              r = \u03BA &middot; \u03B8 = phase &middot; {history.length} total points
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {REGIME_DEFINITIONS.map((def) => (
              <RegimeGeometryCard
                key={def.id}
                regimeId={def.id}
                history={history}
                maxKappa={maxKappa}
                isActive={activeRegimeId === def.id}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
