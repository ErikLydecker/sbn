import { useChartTimeframeStore, type ChartRangeMinutes } from '@/stores/chart-timeframe.store'

const OPTIONS: { label: string; value: ChartRangeMinutes }[] = [
  { label: '1H', value: 60 },
  { label: '2H', value: 120 },
  { label: '3H', value: 180 },
]

export function ChartTimeframeButtons() {
  const range = useChartTimeframeStore((s) => s.range)
  const setRange = useChartTimeframeStore((s) => s.setRange)

  return (
    <div className="flex items-center gap-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setRange(opt.value)}
          className={`rounded px-1.5 py-0.5 text-[9px] font-[590] transition-colors ${
            range === opt.value
              ? 'bg-[rgba(113,112,255,0.2)] text-[#7170ff]'
              : 'text-[#4a4d54] hover:text-[#8a8f98]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
