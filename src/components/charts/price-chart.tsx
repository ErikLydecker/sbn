import { useRef, useEffect, memo } from 'react'
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, type Time, ColorType } from 'lightweight-charts'
import type { OhlcBar } from '@/services/ohlc/aggregator'

interface PriceChartProps {
  candles: OhlcBar[]
}

function toChartData(bars: OhlcBar[]): CandlestickData<Time>[] {
  return bars.map((b) => ({
    time: (Math.floor(b.time / 1000)) as Time,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
  }))
}

export const PriceChart = memo(function PriceChart({ candles }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 260,
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
        timeVisible: true,
        secondsVisible: true,
      },
      handleScroll: { vertTouchDrag: false },
    })

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
    chart.timeScale().fitContent()
  }, [candles])

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
      <div
        ref={containerRef}
        className="w-full rounded-lg"
        style={{ minHeight: 260 }}
      />
    </div>
  )
})
