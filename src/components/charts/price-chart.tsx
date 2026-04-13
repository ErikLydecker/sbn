import { useRef, useEffect } from 'react'
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, type Time } from 'lightweight-charts'
import { chartOptions } from './chart-defaults'
import { BarTimerOverlay } from './bar-timer-overlay'
import { usePriceStore } from '@/stores/price.store'
import { getVisibleRange } from '@/stores/chart-timeframe.store'
import type { OhlcBar } from '@/services/ohlc/aggregator'

function toChartData(bars: OhlcBar[]): CandlestickData<Time>[] {
  const out: CandlestickData<Time>[] = []
  for (const b of bars) {
    const t = Math.floor(b.time / 1000) as Time
    if (out.length > 0 && out[out.length - 1]!.time === t) {
      out[out.length - 1] = { time: t, open: b.open, high: b.high, low: b.low, close: b.close }
    } else {
      out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close })
    }
  }
  return out
}

export function PriceChart({ visibleRangeMinutes }: { visibleRangeMinutes?: number } = {}) {
  const candles = usePriceStore((s) => s.candles)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, chartOptions({
      width: el.clientWidth,
      height: 260,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
    }))

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#7170ff',
      downColor: '#3a3e48',
      borderUpColor: '#8b8aff',
      borderDownColor: '#585c64',
      wickUpColor: '#8b8aff',
      wickDownColor: '#585c64',
    })

    chartRef.current = chart
    seriesRef.current = series

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        if (width > 0) chart.resize(width, 260)
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
    const el = containerRef.current
    if (!series || !chart || !el || candles.length < 1) return
    series.setData(toChartData(candles))
    chart.resize(el.clientWidth, 260, true)
    if (visibleRangeMinutes) {
      const vr = getVisibleRange(visibleRangeMinutes)
      chart.timeScale().setVisibleRange({ from: vr.from as Time, to: vr.to as Time })
    } else {
      chart.timeScale().fitContent()
    }
  }, [candles, visibleRangeMinutes])

  const closes = candles.map((c) => c.close)
  const latest = closes.length > 0 ? closes[closes.length - 1]! : null
  const mean = closes.length > 0 ? closes.reduce((s, v) => s + v, 0) / closes.length : 0
  const std = closes.length > 1
    ? Math.sqrt(closes.reduce((s, v) => s + (v - mean) ** 2, 0) / closes.length)
    : 0
  const fmt = (v: number) => v.toFixed(2)

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2.5 text-[10px] font-[510] text-[#62666d]">
        <span>
          LAST{' '}
          <span className="text-[#d0d6e0]">{latest != null ? fmt(latest) : '—'}</span>
        </span>
        <span>
          MEAN{' '}
          <span className="text-[#8a8f98]">{closes.length > 0 ? fmt(mean) : '—'}</span>
        </span>
        <span>
          STD{' '}
          <span className="text-[#8a8f98]">{closes.length > 1 ? fmt(std) : '—'}</span>
        </span>
        <span>
          N{' '}
          <span className="text-[#8a8f98]">{candles.length}</span>
        </span>
      </div>
      <div className="relative">
        <div
          ref={containerRef}
          className="w-full rounded-lg"
          style={{ minHeight: 260 }}
        />
        <BarTimerOverlay />
      </div>
    </div>
  )
}
