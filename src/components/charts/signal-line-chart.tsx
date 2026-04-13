import { useRef, useEffect, memo } from 'react'
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  LineType,
} from 'lightweight-charts'
import { chartOptions } from './chart-defaults'
import { BarTimerOverlay } from './bar-timer-overlay'
import { getVisibleRange } from '@/stores/chart-timeframe.store'

interface SignalLineChartProps {
  data: number[]
  timestamps?: number[]
  color?: string
  height?: number
  formatValue?: (v: number) => string
  visibleRangeMinutes?: number
}

const DEFAULT_FORMAT = (v: number) => v.toFixed(6)

export const SignalLineChart = memo(function SignalLineChart({
  data,
  timestamps,
  color = 'rgba(255,255,255,0.85)',
  height = 260,
  formatValue = DEFAULT_FORMAT,
  visibleRangeMinutes,
}: SignalLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, chartOptions({
      width: el.clientWidth,
      height,
      rightPriceScale: {
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        visible: true,
        timeVisible: true,
        secondsVisible: false,
      },
    }))

    const series = chart.addSeries(LineSeries, {
      color,
      lineWidth: 1,
      lineType: LineType.Curved,
      priceFormat: { type: 'custom', formatter: (v: number) => formatValue(v) },
      crosshairMarkerRadius: 2,
      crosshairMarkerBackgroundColor: color,
      lastValueVisible: true,
      priceLineVisible: false,
    })

    seriesRef.current = series
    chartRef.current = chart

    if (data.length > 1 && timestamps && timestamps.length === data.length) {
      series.setData(toLineData(data, timestamps))
      if (visibleRangeMinutes) {
        const vr = getVisibleRange(visibleRangeMinutes)
        chart.timeScale().setVisibleRange({ from: vr.from as Time, to: vr.to as Time })
      } else {
        chart.timeScale().fitContent()
      }
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        if (width > 0) chart.resize(width, height)
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart || data.length < 2) return
    if (!timestamps || timestamps.length !== data.length) return

    series.setData(toLineData(data, timestamps))
    if (visibleRangeMinutes) {
      const vr = getVisibleRange(visibleRangeMinutes)
      chart.timeScale().setVisibleRange({ from: vr.from as Time, to: vr.to as Time })
    } else {
      chart.timeScale().fitContent()
    }
  }, [data, timestamps, visibleRangeMinutes])

  const latest = data.length > 0 ? data[data.length - 1]! : null
  const mean = data.length > 0 ? data.reduce((s, v) => s + v, 0) / data.length : 0
  const std = data.length > 1
    ? Math.sqrt(data.reduce((s, v) => s + (v - mean) ** 2, 0) / data.length)
    : 0

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2.5 text-[10px] font-[510] text-[#62666d]">
        <span>
          LAST{' '}
          <span className="text-[#d0d6e0]">{latest != null ? formatValue(latest) : '—'}</span>
        </span>
        <span>
          MEAN{' '}
          <span className="text-[#8a8f98]">{data.length > 0 ? formatValue(mean) : '—'}</span>
        </span>
        <span>
          STD{' '}
          <span className="text-[#8a8f98]">{data.length > 1 ? formatValue(std) : '—'}</span>
        </span>
        <span>
          N{' '}
          <span className="text-[#8a8f98]">{data.length}</span>
        </span>
      </div>
      <div className="relative">
        <div
          ref={containerRef}
          className="w-full rounded-lg"
          style={{ minHeight: height }}
        />
        <BarTimerOverlay />
      </div>
    </div>
  )
})

function toLineData(values: number[], timestamps: number[]): LineData<Time>[] {
  const out: LineData<Time>[] = []
  for (let i = 0; i < values.length; i++) {
    const t = Math.floor(timestamps[i]! / 1000) as Time
    if (out.length > 0 && out[out.length - 1]!.time === t) {
      out[out.length - 1] = { time: t, value: values[i]! }
    } else {
      out.push({ time: t, value: values[i]! })
    }
  }
  return out
}
