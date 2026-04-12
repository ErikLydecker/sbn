import { memo } from 'react'
import { MetricsHistoryChart } from './metrics-history-chart'
import type { CoherencePoint } from '@/services/persistence/db'

interface StructureHistoryChartProps {
  points: CoherencePoint[]
}

export const StructureHistoryChart = memo(function StructureHistoryChart({
  points,
}: StructureHistoryChartProps) {
  return (
    <MetricsHistoryChart
      points={points}
      valueKey="structureScore"
      color="#50dd80"
      label="STRUCTURE"
      thresholdValue={0.5}
    />
  )
})
