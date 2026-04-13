import { memo } from 'react'
import { MetricsHistoryChart } from './metrics-history-chart'
import type { CoherencePoint } from '@/services/persistence/db'

interface CoherenceHistoryChartProps {
  points: CoherencePoint[]
  visibleRangeMinutes?: number
}

export const CoherenceHistoryChart = memo(function CoherenceHistoryChart({
  points,
  visibleRangeMinutes,
}: CoherenceHistoryChartProps) {
  return (
    <MetricsHistoryChart
      points={points}
      valueKey="rBar"
      color="#d0d6e0"
      label="COHERENCE"
      thresholdValue={0.12}
      visibleRangeMinutes={visibleRangeMinutes}
    />
  )
})
