import { useRef, useEffect, memo } from 'react'
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  LineType,
  LastPriceAnimationMode,
} from 'lightweight-charts'
import { chartOptions } from './chart-defaults'
import { getVisibleRange } from '@/stores/chart-timeframe.store'

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
  visibleRangeMinutes?: number
}

export const LwLineChart = memo(function LwLineChart({
  data,
  height = 200,
  lineColor = '#7170ff',
  areaTopColor = 'rgba(113,112,255,0.18)',
  areaBottomColor = 'rgba(113,112,255,0.0)',
  precision = 2,
  formatValue,
  visibleRangeMinutes,
}: LwLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, chartOptions({
      width: el.clientWidth,
      height,
      timeScale: {
        visible: true,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    }))

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
    const chartData: LineData<Time>[] = []
    for (const d of data) {
      const t = d.time as Time
      if (chartData.length > 0 && chartData[chartData.length - 1]!.time === t) {
        chartData[chartData.length - 1] = { time: t, value: d.value }
      } else {
        chartData.push({ time: t, value: d.value })
      }
    }
    series.setData(chartData)
    if (visibleRangeMinutes) {
      const vr = getVisibleRange(visibleRangeMinutes)
      chartRef.current?.timeScale().setVisibleRange({ from: vr.from as Time, to: vr.to as Time })
    } else if (!fittedRef.current) {
      chartRef.current?.timeScale().fitContent()
      fittedRef.current = true
    }
  }, [data, visibleRangeMinutes])

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg"
      style={{ minHeight: height }}
    />
  )
})
