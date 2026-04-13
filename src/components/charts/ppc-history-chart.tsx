import { memo } from 'react'
import { MetricsHistoryChart } from './metrics-history-chart'
import type { CoherencePoint } from '@/services/persistence/db'

interface PpcHistoryChartProps {
  points: CoherencePoint[]
  visibleRangeMinutes?: number
}

export const PpcHistoryChart = memo(function PpcHistoryChart({
  points,
  visibleRangeMinutes,
}: PpcHistoryChartProps) {
  return (
    <MetricsHistoryChart
      points={points}
      valueKey="ppc"
      color="#40e0d0"
      label="PPC"
      thresholdValue={0}
      visibleRangeMinutes={visibleRangeMinutes}
    />
  )
})
