import { DSP_CONFIG } from '@/config/dsp'

export class EventClockResampler {
  private bars: number[] = []
  private lastPrice = 0

  pushPrice(price: number): number[] {
    if (this.lastPrice === 0) {
      this.lastPrice = price
      return this.bars
    }

    const ret = Math.log(price / this.lastPrice)
    this.lastPrice = price
    this.bars.push(ret)

    if (this.bars.length > DSP_CONFIG.maxEventBars) {
      this.bars.shift()
    }

    return this.bars
  }

  getBars(): number[] {
    return this.bars
  }

  getBarCount(): number {
    return this.bars.length
  }

  reset(): void {
    this.bars = []
    this.lastPrice = 0
  }
}
