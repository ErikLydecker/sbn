import { Attractor3dChart } from '@/components/charts/attractor-3d-chart'
import { Attractor2dChart } from '@/components/charts/attractor-2d-chart'
import { RecurrenceChart } from '@/components/charts/recurrence-chart'
import { RecurrenceHistoryChart } from '@/components/charts/recurrence-history-chart'
import { StructureHistoryChart } from '@/components/charts/structure-history-chart'
import { TopologyHistoryChart } from '@/components/charts/topology-history-chart'
import { WindingHistoryChart } from '@/components/charts/winding-history-chart'
import { TopologyClassTimeline } from '@/components/charts/topology-class-timeline'
import { TopologyPanel } from '@/components/panels/topology-panel'
import { TopologyFingerprintTable } from '@/components/panels/topology-fingerprint-table'
import { useAnalysisStore } from '@/stores/analysis.store'
import { useCoherenceHistoryStore } from '@/stores/coherence-history.store'
import { useTopologyStore } from '@/stores/topology.store'
import { Card, CardContent, CardTitle, CardHeader } from '@/components/ui/card'

export function TopologyPage() {
  const smooth = useAnalysisStore((s) => s.smooth)
  const coherencePoints = useCoherenceHistoryStore((s) => s.points)
  const fingerprints = useTopologyStore((s) => s.fingerprints)
  const currentMatches = useTopologyStore((s) => s.currentMatches)

  return (
    <div className="space-y-3">
      {/* Row 1: Live attractor visualization */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              3D Attractor
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">PCA projection &middot; drag to rotate</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Attractor3dChart pts={smooth?.embeddingVecs ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              2D Projection
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">PC1 vs PC2 &middot; phase extraction plane</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Attractor2dChart pts={smooth?.embeddingVecs ?? []} />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Live topology diagnostics + recurrence plot */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Topology Invariants</CardTitle>
          </CardHeader>
          <CardContent>
            <TopologyPanel
              smooth={smooth}
              matchCount={currentMatches.length}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Recurrence Plot
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">R(i,j) = &#x2016;v&#x1D62;&minus;v&#x2C7C;&#x2016; &lt; &epsilon;</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecurrenceChart
              matrix={smooth?.recurrenceMatrix ?? []}
              size={smooth?.recurrenceSize ?? 0}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Topology time series */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Topology Score
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">composite quality &middot; {coherencePoints.length} pts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TopologyHistoryChart points={coherencePoints} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Winding Number
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">loop existence &middot; |w|&ge;0.7 = loop</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WindingHistoryChart points={coherencePoints} />
          </CardContent>
        </Card>
      </div>

      {/* Topology class timeline */}
      <Card>
        <CardHeader>
          <CardTitle>
            Topology Class Transitions
            <span className="ml-2 text-[11px] font-normal text-[#62666d]">regime structural state over time</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TopologyClassTimeline points={coherencePoints} />
        </CardContent>
      </Card>

      {/* Row 4: Existing quality metrics (moved from dashboard) */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Recurrence Rate
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">phase-space revisitation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecurrenceHistoryChart points={coherencePoints} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Structure
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">attractor symmetry</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StructureHistoryChart points={coherencePoints} />
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Fingerprint recurrence table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Topology Fingerprint Recurrence
            <span className="ml-2 text-[11px] font-normal text-[#62666d]">
              similar topologies in history &middot; {fingerprints.length} snapshots
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TopologyFingerprintTable
            fingerprints={fingerprints}
            currentMatches={currentMatches}
          />
        </CardContent>
      </Card>
    </div>
  )
}
