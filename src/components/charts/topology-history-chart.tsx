import { memo } from 'react'
import { MetricsHistoryChart } from './metrics-history-chart'
import type { CoherencePoint } from '@/services/persistence/db'

interface TopologyHistoryChartProps {
  points: CoherencePoint[]
}

export const TopologyHistoryChart = memo(function TopologyHistoryChart({
  points,
}: TopologyHistoryChartProps) {
  return (
    <MetricsHistoryChart
      points={points}
      valueKey="topologyScore"
      color="#7170ff"
      label="TOPOLOGY"
      thresholdValue={0.3}
    />
  )
})
