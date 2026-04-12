import { describe, it, expect } from 'vitest'
import { detrend } from './detrend'

describe('detrend', () => {
  it('removes linear trend from ascending series', () => {
    const input = [1, 2, 3, 4, 5]
    const result = detrend(input)
    const mean = result.reduce((a, b) => a + b, 0) / result.length
    expect(Math.abs(mean)).toBeLessThan(1e-10)
  })

  it('returns zero-mean for constant array', () => {
    const result = detrend([5, 5, 5, 5])
    result.forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-10))
  })

  it('handles single-element array', () => {
    expect(detrend([42])).toEqual([42])
  })

  it('preserves oscillatory component', () => {
    const n = 100
    const sig = Array.from({ length: n }, (_, i) => 2 * i + 10 * Math.sin((2 * Math.PI * i) / 20))
    const result = detrend(sig)
    const maxAbs = Math.max(...result.map(Math.abs))
    expect(maxAbs).toBeGreaterThan(5)
    expect(maxAbs).toBeLessThan(15)
  })
})
