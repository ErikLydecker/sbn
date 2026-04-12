import { useRef, useEffect, memo, useMemo } from 'react'
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
import type { CoherencePoint } from '@/services/persistence/db'
import { dema } from '@/core/math/dema'

interface MetricsHistoryChartProps {
  points: CoherencePoint[]
  valueKey: 'rBar' | 'recurrenceRate' | 'structureScore' | 'tDom'
  color: string
  label: string
  thresholdValue?: number
  formatValue?: (v: number) => string
}

const DEFAULT_FORMAT = (v: number) => `${(v * 100).toFixed(1)}%`

function extractSeries(
  points: CoherencePoint[],
  key: 'rBar' | 'recurrenceRate' | 'structureScore' | 'tDom',
): { times: number[]; values: number[] } {
  const times: number[] = []
  const values: number[] = []
  for (const p of points) {
    const v = p[key]
    if (v == null) continue
    times.push(Math.floor(p.timestamp / 1000))
    values.push(v)
  }
  return { times, values }
}

function toLineData(times: number[], values: number[]): LineData<Time>[] {
  return times.map((t, i) => ({ time: t as Time, value: values[i]! }))
}

export const MetricsHistoryChart = memo(function MetricsHistoryChart({
  points,
  valueKey,
  color,
  label,
  thresholdValue,
  formatValue = DEFAULT_FORMAT,
}: MetricsHistoryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainRef = useRef<ISeriesApi<'Line'> | null>(null)
  const dema50Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const dema200Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const thresholdRef = useRef<ISeriesApi<'Line'> | null>(null)

  const { times, values } = useMemo(() => extractSeries(points, valueKey), [points, valueKey])
  const dema50 = useMemo(() => dema(values, 50), [values])
  const dema200 = useMemo(() => dema(values, 200), [values])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 320,
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
        vertLine: { color: `${color}4d`, labelBackgroundColor: color },
        horzLine: { color: `${color}4d`, labelBackgroundColor: color },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    })

    const mainSeries = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0.85)',
      lineWidth: 1,
      lineType: LineType.Curved,
      priceFormat: { type: 'custom', formatter: (v: number) => formatValue(v) },
      crosshairMarkerRadius: 3,
      crosshairMarkerBackgroundColor: 'rgba(255,255,255,0.85)',
      lastValueVisible: true,
      priceLineVisible: false,
    })

    const d50Series = chart.addSeries(LineSeries, {
      color: '#ffaa33',
      lineWidth: 2,
      lineType: LineType.Curved,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    const d200Series = chart.addSeries(LineSeries, {
      color: '#50dd80',
      lineWidth: 2,
      lineType: LineType.Curved,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    let thresholdSeries: ISeriesApi<'Line'> | null = null
    if (thresholdValue != null) {
      thresholdSeries = chart.addSeries(LineSeries, {
        color: 'rgba(255,80,80,0.35)',
        lineWidth: 1,
        lineStyle: 2,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      })
    }

    mainRef.current = mainSeries
    dema50Ref.current = d50Series
    dema200Ref.current = d200Series
    thresholdRef.current = thresholdSeries
    chartRef.current = chart

    if (times.length > 1) {
      mainSeries.setData(toLineData(times, values))
      if (dema50.length > 0) d50Series.setData(toLineData(times, dema50))
      if (dema200.length > 0) d200Series.setData(toLineData(times, dema200))
      if (thresholdSeries && thresholdValue != null) {
        thresholdSeries.setData([
          { time: times[0]! as Time, value: thresholdValue },
          { time: times[times.length - 1]! as Time, value: thresholdValue },
        ])
      }
      chart.timeScale().fitContent()
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        if (width > 0) chart.resize(width, 320)
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      mainRef.current = null
      dema50Ref.current = null
      dema200Ref.current = null
      thresholdRef.current = null
    }
  }, [])

  useEffect(() => {
    const main = mainRef.current
    const d50 = dema50Ref.current
    const d200 = dema200Ref.current
    const threshold = thresholdRef.current
    const chart = chartRef.current
    if (!main || !chart || times.length < 2) return

    main.setData(toLineData(times, values))
    if (d50 && dema50.length > 0) d50.setData(toLineData(times, dema50))
    if (d200 && dema200.length > 0) d200.setData(toLineData(times, dema200))

    if (threshold && thresholdValue != null) {
      threshold.setData([
        { time: times[0]! as Time, value: thresholdValue },
        { time: times[times.length - 1]! as Time, value: thresholdValue },
      ])
    }

    chart.timeScale().scrollToRealTime()
  }, [times, values, dema50, dema200, thresholdValue])

  const latest = values.length > 0 ? values[values.length - 1]! : null
  const avg = values.length > 0
    ? values.reduce((s, v) => s + v, 0) / values.length
    : 0
  const latestD50 = dema50.length > 0 ? dema50[dema50.length - 1]! : null
  const latestD200 = dema200.length > 0 ? dema200[dema200.length - 1]! : null

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2.5 text-[10px] font-[510] text-[#62666d]">
        <span>
          {label}{' '}
          <span style={{ color }}>{latest != null ? formatValue(latest) : '—'}</span>
        </span>
        <span>
          AVG{' '}
          <span className="text-[#8a8f98]">{values.length > 0 ? formatValue(avg) : '—'}</span>
        </span>
        <span>
          <span className="text-[#ffaa33]">D50</span>{' '}
          <span className="text-[#ffaa33]">{latestD50 != null ? formatValue(latestD50) : '—'}</span>
        </span>
        <span>
          <span className="text-[#50dd80]">D200</span>{' '}
          <span className="text-[#50dd80]">{latestD200 != null ? formatValue(latestD200) : '—'}</span>
        </span>
      </div>
      <div
        ref={containerRef}
        className="w-full rounded-lg"
        style={{ minHeight: 320 }}
      />
    </div>
  )
})
