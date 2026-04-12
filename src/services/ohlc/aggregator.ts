export interface OhlcBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  ticks: number
}

export type Timeframe = '1s' | '1m' | '5m'

const TF_MS: Record<Timeframe, number> = {
  '1s': 1_000,
  '1m': 60_000,
  '5m': 300_000,
}

export class OhlcAggregator {
  private intervalMs: number
  private bars: OhlcBar[] = []
  private current: OhlcBar | null = null
  private maxBars: number

  constructor(tf: Timeframe, maxBars = 512) {
    this.intervalMs = TF_MS[tf]
    this.maxBars = maxBars
  }

  setTimeframe(tf: Timeframe): void {
    const newInterval = TF_MS[tf]
    if (newInterval === this.intervalMs) return
    if (this.current) {
      this.finalize()
    }
    this.intervalMs = newInterval
    this.bars = []
    this.current = null
  }

  pushTick(price: number, now = Date.now()): OhlcBar | null {
    const bucketStart = now - (now % this.intervalMs)

    if (!this.current) {
      this.current = { time: bucketStart, open: price, high: price, low: price, close: price, ticks: 1 }
      return null
    }

    if (bucketStart > this.current.time) {
      const closed = this.finalize()
      this.current = { time: bucketStart, open: price, high: price, low: price, close: price, ticks: 1 }
      return closed
    }

    this.current.high = Math.max(this.current.high, price)
    this.current.low = Math.min(this.current.low, price)
    this.current.close = price
    this.current.ticks++
    return null
  }

  getCurrent(): OhlcBar | null {
    return this.current
  }

  getBars(): OhlcBar[] {
    return this.bars
  }

  getSnapshot(): OhlcBar[] {
    if (!this.current) return this.bars.slice()
    return [...this.bars, this.current]
  }

  loadHistorical(bars: OhlcBar[]): void {
    if (bars.length === 0) return
    this.bars = bars.slice(0, -1).slice(-this.maxBars)
    this.current = { ...bars[bars.length - 1]! }
  }

  reset(): void {
    this.bars = []
    this.current = null
  }

  private finalize(): OhlcBar {
    const bar = this.current!
    this.bars.push(bar)
    if (this.bars.length > this.maxBars) {
      this.bars.shift()
    }
    return bar
  }
}
