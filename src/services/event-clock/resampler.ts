import { DSP_CONFIG } from '@/config/dsp'

export class EventClockResampler {
  private bars: number[] = []
  private timestamps: number[] = []
  private lastPrice = 0

  pushPrice(price: number, timestamp?: number): number[] {
    if (this.lastPrice === 0) {
      this.lastPrice = price
      return this.bars
    }

    const ret = Math.log(price / this.lastPrice)
    this.lastPrice = price
    this.bars.push(ret)
    this.timestamps.push(timestamp ?? Date.now())

    if (this.bars.length > DSP_CONFIG.maxEventBars) {
      this.bars.shift()
      this.timestamps.shift()
    }

    return this.bars
  }

  getBars(): number[] {
    return this.bars
  }

  getTimestamps(): number[] {
    return this.timestamps
  }

  getBarCount(): number {
    return this.bars.length
  }

  restore(bars: number[], timestamps: number[], lastPrice: number): void {
    this.bars = bars.slice()
    this.timestamps = timestamps.slice()
    this.lastPrice = lastPrice
  }

  getLastPrice(): number {
    return this.lastPrice
  }

  reset(): void {
    this.bars = []
    this.timestamps = []
    this.lastPrice = 0
  }
}
