import { describe, it, expect } from 'vitest'
import { estimateTau } from './tau'

function makeSine(n: number, period: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * i) / period))
}

function addNoise(sig: number[], amplitude: number, seed: number): number[] {
  let s = seed
  const next = () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    return (s / 0x7fffffff) * 2 - 1
  }
  return sig.map((v) => v + next() * amplitude)
}

function logisticMap(n: number, r: number, x0: number): number[] {
  const out = [x0]
  for (let i = 1; i < n; i++) {
    const prev = out[i - 1]!
    out.push(r * prev * (1 - prev))
  }
  return out
}

function whiteNoise(n: number, seed: number): number[] {
  let s = seed
  const next = () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    return (s / 0x7fffffff) * 2 - 1
  }
  return Array.from({ length: n }, () => next())
}

describe('estimateTau (AMI-based)', () => {
  it('finds ~T/4 for a pure sinusoid', () => {
    const period = 40
    const sig = makeSine(400, period)
    const tau = estimateTau(sig, Math.floor(period / 2))
    expect(tau).toBeGreaterThanOrEqual(8)
    expect(tau).toBeLessThanOrEqual(14)
  })

  it('stays near T/4 with moderate noise', () => {
    const period = 40
    const sig = addNoise(makeSine(400, period), 0.2, 42)
    const tau = estimateTau(sig, Math.floor(period / 2))
    expect(tau).toBeGreaterThanOrEqual(5)
    expect(tau).toBeLessThanOrEqual(16)
  })

  it('returns tau > 1 for logistic map (chaos)', () => {
    const sig = logisticMap(500, 3.9, 0.4)
    const tau = estimateTau(sig, 20)
    expect(tau).toBeGreaterThanOrEqual(2)
  })

  it('returns tau >= 2 for white noise', () => {
    const sig = whiteNoise(500, 123)
    const tau = estimateTau(sig, 20)
    expect(tau).toBeGreaterThanOrEqual(2)
  })

  it('never returns tau=1 (regression guard)', () => {
    const trendyNoisy = Array.from({ length: 200 }, (_, i) => {
      const trend = i * 0.01
      const cycle = 0.3 * Math.sin((2 * Math.PI * i) / 30)
      const noise = ((((i * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff) * 2 - 1) * 0.5
      return trend + cycle + noise
    })
    const tau = estimateTau(trendyNoisy, 15)
    expect(tau).toBeGreaterThanOrEqual(2)
  })

  it('handles short signals gracefully', () => {
    const sig = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const tau = estimateTau(sig, 5)
    expect(tau).toBeGreaterThanOrEqual(2)
  })

  it('handles constant signal', () => {
    const sig = new Array(100).fill(5) as number[]
    const tau = estimateTau(sig, 10)
    expect(tau).toBeGreaterThanOrEqual(2)
  })

  it('finds reasonable tau for two superimposed sinusoids', () => {
    const n = 400
    const sig = Array.from({ length: n }, (_, i) =>
      Math.sin((2 * Math.PI * i) / 40) + 0.5 * Math.sin((2 * Math.PI * i) / 15),
    )
    const tau = estimateTau(sig, 20)
    expect(tau).toBeGreaterThanOrEqual(2)
    expect(tau).toBeLessThanOrEqual(15)
  })
})
