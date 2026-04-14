import { CurvatureProfileChart } from '@/components/charts/curvature-profile-chart'
import { BettiCurveChart } from '@/components/charts/betti-curve-chart'
import { SpeciesRadarChart } from '@/components/charts/species-radar-chart'
import { SpeciesPerformanceTable } from '@/components/charts/species-performance-table'
import { SpeciesHeatmap } from '@/components/charts/species-heatmap'
import { CurvatureHistoryChart } from '@/components/charts/curvature-history-chart'
import { useMorphologyStore } from '@/stores/morphology.store'
import { Card, CardContent, CardTitle, CardHeader } from '@/components/ui/card'

export function MorphologyPage() {
  const curvatureProfile = useMorphologyStore((s) => s.curvatureProfile)
  const bettiH0 = useMorphologyStore((s) => s.bettiH0)
  const bettiH1 = useMorphologyStore((s) => s.bettiH1)
  const bettiThresholds = useMorphologyStore((s) => s.bettiThresholds)
  const fourierDescriptors = useMorphologyStore((s) => s.fourierDescriptors)
  const currentSpecies = useMorphologyStore((s) => s.currentSpecies)
  const curvatureHistory = useMorphologyStore((s) => s.curvatureHistory)
  const torsionHistory = useMorphologyStore((s) => s.torsionHistory)
  const speciesHistory = useMorphologyStore((s) => s.speciesHistory)
  const speciesCatalog = useMorphologyStore((s) => s.speciesCatalog)

  const latestCurv = curvatureHistory.length > 0
    ? curvatureHistory[curvatureHistory.length - 1]!
    : null

  const h1Peak = bettiH1.length > 0 ? Math.max(...bettiH1) : 0

  return (
    <div className="space-y-3">
      {/* Row 1: Curvature Profile + Betti Curves */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Curvature Profile
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">
                Menger &kappa; along arc-length &middot; {curvatureProfile.length} pts
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {curvatureProfile.length >= 2 ? (
              <>
                <CurvatureProfileChart
                  profile={curvatureProfile}
                  concentration={latestCurv?.concentration ?? 0}
                />
                <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-[510] text-[#62666d]">
                  <span>
                    MEAN{' '}
                    <span className="text-[#d0d6e0]">{latestCurv?.mean.toFixed(4) ?? '—'}</span>
                  </span>
                  <span>
                    MAX{' '}
                    <span className="text-[#d0d6e0]">{latestCurv?.max.toFixed(4) ?? '—'}</span>
                  </span>
                  <span>
                    CONC{' '}
                    <span className="text-[#ffaa33]">
                      {latestCurv ? `${(latestCurv.concentration * 100).toFixed(1)}%` : '—'}
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <div className="flex h-60 items-center justify-center text-[11px] text-[#62666d]">
                Awaiting embedding data...
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Betti Curves
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">
                H0 (components) &middot; H1 (loops) vs &epsilon;
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bettiH0.length >= 2 ? (
              <BettiCurveChart
                h0={bettiH0}
                h1={bettiH1}
                thresholds={bettiThresholds}
                h1Peak={h1Peak}
              />
            ) : (
              <div className="flex h-60 items-center justify-center text-[11px] text-[#62666d]">
                Awaiting persistence data...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Fourier Radar + Species Catalog */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Fourier Shape Descriptor
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">
                curvature signature harmonics &middot; species S-{currentSpecies >= 0 ? currentSpecies : '?'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fourierDescriptors.length >= 3 ? (
              <SpeciesRadarChart current={fourierDescriptors} />
            ) : (
              <div className="flex h-60 items-center justify-center text-[11px] text-[#62666d]">
                Awaiting Fourier descriptors...
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Species Catalog
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">
                {speciesCatalog.length} species discovered &middot; active S-{currentSpecies >= 0 ? currentSpecies : '?'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpeciesPerformanceTable
              catalog={speciesCatalog}
              currentSpecies={currentSpecies}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Curvature + Torsion History Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>
            Curvature &amp; Torsion History
            <span className="ml-2 text-[11px] font-normal text-[#62666d]">
              mean &kappa; + &tau; energy over time &middot; species-colored markers
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {curvatureHistory.length >= 2 ? (
            <CurvatureHistoryChart
              curvatureHistory={curvatureHistory}
              torsionHistory={torsionHistory}
              speciesHistory={speciesHistory}
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-[11px] text-[#62666d]">
              Accumulating curvature history...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 4: Species-Regime Performance Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>
            Species &times; Regime Performance
            <span className="ml-2 text-[11px] font-normal text-[#62666d]">
              avg return per species-regime combination
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SpeciesHeatmap
            catalog={speciesCatalog}
            currentSpecies={currentSpecies}
          />
        </CardContent>
      </Card>
    </div>
  )
}
