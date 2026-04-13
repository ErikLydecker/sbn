import { memo } from 'react'
import { MetricsHistoryChart } from './metrics-history-chart'
import type { CoherencePoint } from '@/services/persistence/db'

interface WindingHistoryChartProps {
  points: CoherencePoint[]
}

export const WindingHistoryChart = memo(function WindingHistoryChart({
  points,
}: WindingHistoryChartProps) {
  return (
    <MetricsHistoryChart
      points={points}
      valueKey="windingNumber"
      color="#50dd80"
      label="WINDING"
      thresholdValue={0.7}
      formatValue={(v) => v.toFixed(2)}
    />
  )
})
