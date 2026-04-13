import { memo } from 'react'
import { MetricsHistoryChart } from './metrics-history-chart'
import type { CoherencePoint } from '@/services/persistence/db'

interface RecurrenceHistoryChartProps {
  points: CoherencePoint[]
}

export const RecurrenceHistoryChart = memo(function RecurrenceHistoryChart({
  points,
}: RecurrenceHistoryChartProps) {
  return (
    <MetricsHistoryChart
      points={points}
      valueKey="fixedRecurrenceRate"
      color="#d0d6e0"
      label="RECURRENCE RATE"
      thresholdValue={0.1}
    />
  )
})
