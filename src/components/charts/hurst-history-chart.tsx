import { memo } from 'react'
import { MetricsHistoryChart } from './metrics-history-chart'
import type { CoherencePoint } from '@/services/persistence/db'

interface HurstHistoryChartProps {
  points: CoherencePoint[]
  visibleRangeMinutes?: number
}

export const HurstHistoryChart = memo(function HurstHistoryChart({
  points,
  visibleRangeMinutes,
}: HurstHistoryChartProps) {
  return (
    <MetricsHistoryChart
      points={points}
      valueKey="hurst"
      color="#ff8844"
      label="HURST"
      thresholdValue={0.5}
      formatValue={(v) => v.toFixed(3)}
      visibleRangeMinutes={visibleRangeMinutes}
    />
  )
})
