import { memo } from 'react'
import { MetricsHistoryChart } from './metrics-history-chart'
import type { CoherencePoint } from '@/services/persistence/db'

interface TdomHistoryChartProps {
  points: CoherencePoint[]
}

export const TdomHistoryChart = memo(function TdomHistoryChart({
  points,
}: TdomHistoryChartProps) {
  return (
    <MetricsHistoryChart
      points={points}
      valueKey="tDom"
      color="#d0d6e0"
      label="T_DOM"
      formatValue={(v: number) => `${v.toFixed(0)} bars`}
    />
  )
})
