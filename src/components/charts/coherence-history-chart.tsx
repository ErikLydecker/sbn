import { memo } from 'react'
import { MetricsHistoryChart } from './metrics-history-chart'
import type { CoherencePoint } from '@/services/persistence/db'

interface CoherenceHistoryChartProps {
  points: CoherencePoint[]
}

export const CoherenceHistoryChart = memo(function CoherenceHistoryChart({
  points,
}: CoherenceHistoryChartProps) {
  return (
    <MetricsHistoryChart
      points={points}
      valueKey="rBar"
      color="#7170ff"
      label="COHERENCE"
      thresholdValue={0.12}
    />
  )
})
