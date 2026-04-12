import { describe, it, expect } from 'vitest'
import { dft } from './dft'

describe('dft', () => {
  it('detects dominant frequency in pure sinusoid', () => {
    const n = 128
    const k = 5
    const sig = Array.from({ length: n }, (_, t) => Math.sin((2 * Math.PI * k * t) / n))
    const result = dft(sig)
    const sorted = result.slice().sort((a, b) => b.amp - a.amp)
    expect(sorted[0]!.k).toBe(k)
  })

  it('returns correct number of bins', () => {
    const sig = new Array(64).fill(0).map(() => Math.random())
    const result = dft(sig)
    expect(result.length).toBe(32)
  })

  it('returns zero amplitude for DC signal', () => {
    const sig = new Array(64).fill(1)
    const result = dft(sig)
    result.forEach((bin) => {
      expect(bin.amp).toBeLessThan(0.01)
    })
  })
})
