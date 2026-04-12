import { useRef, useEffect, memo } from 'react'
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  ColorType,
  LineType,
} from 'lightweight-charts'

interface SignalLineChartProps {
  data: number[]
  color?: string
  height?: number
  formatValue?: (v: number) => string
}

const DEFAULT_FORMAT = (v: number) => v.toFixed(6)

export const SignalLineChart = memo(function SignalLineChart({
  data,
  color = 'rgba(255,255,255,0.85)',
  height = 260,
  formatValue = DEFAULT_FORMAT,
}: SignalLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#62666d',
        fontSize: 10,
        fontFamily: "'SF Mono', 'Fira Code', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(113,112,255,0.3)', labelBackgroundColor: '#7170ff' },
        horzLine: { color: 'rgba(113,112,255,0.3)', labelBackgroundColor: '#7170ff' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        visible: true,
      },
      handleScroll: { vertTouchDrag: false },
    })

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

    if (data.length > 1) {
      series.setData(toLineData(data))
      chart.timeScale().fitContent()
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

    series.setData(toLineData(data))
    chart.timeScale().fitContent()
  }, [data])

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
      <div
        ref={containerRef}
        className="w-full rounded-lg"
        style={{ minHeight: height }}
      />
    </div>
  )
})

function toLineData(values: number[]): LineData<Time>[] {
  return values.map((v, i) => ({ time: (i + 1) as Time, value: v }))
}
