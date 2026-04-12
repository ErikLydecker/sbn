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
  LastPriceAnimationMode,
} from 'lightweight-charts'

export interface LwLinePoint {
  time: number
  value: number
}

interface LwLineChartProps {
  data: LwLinePoint[]
  height?: number
  lineColor?: string
  areaTopColor?: string
  areaBottomColor?: string
  precision?: number
  formatValue?: (v: number) => string
}

export const LwLineChart = memo(function LwLineChart({
  data,
  height = 200,
  lineColor = '#7170ff',
  areaTopColor = 'rgba(113,112,255,0.18)',
  areaBottomColor = 'rgba(113,112,255,0.0)',
  precision = 2,
  formatValue,
}: LwLineChartProps) {
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
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        visible: true,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    })

    const series = chart.addSeries(LineSeries, {
      color: lineColor,
      lineWidth: 2,
      lineType: LineType.Curved,
      lastPriceAnimation: LastPriceAnimationMode.Continuous,
      priceFormat: {
        type: 'custom',
        formatter: formatValue ?? ((v: number) => v.toFixed(precision)),
      },
    })

    chartRef.current = chart
    seriesRef.current = series

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        if (width > 0) chart.applyOptions({ width })
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      fittedRef.current = false
    }
  }, [height, lineColor, areaTopColor, areaBottomColor, precision, formatValue])

  const fittedRef = useRef(false)

  useEffect(() => {
    const series = seriesRef.current
    if (!series || data.length < 1) return
    const chartData: LineData<Time>[] = data.map((d) => ({
      time: d.time as Time,
      value: d.value,
    }))
    series.setData(chartData)
    if (!fittedRef.current) {
      chartRef.current?.timeScale().fitContent()
      fittedRef.current = true
    }
  }, [data])

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg"
      style={{ minHeight: height }}
    />
  )
})
