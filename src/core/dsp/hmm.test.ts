import { describe, it, expect } from 'vitest'
import { buildHmmTransition, hmmForward, hmmToClockPos, type HmmAlpha } from './hmm'

describe('buildHmmTransition', () => {
  it('rows sum to 1', () => {
    const A = buildHmmTransition(40)
    for (const row of A) {
      const sum = row.reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 10)
    }
  })

  it('has only self and forward transitions', () => {
    const A = buildHmmTransition(40)
    expect(A[0]![2]).toBe(0)
    expect(A[0]![3]).toBe(0)
    expect(A[1]![0]).toBe(0)
    expect(A[1]![3]).toBe(0)
  })
})

describe('hmmForward', () => {
  it('returns valid probability distribution', () => {
    const A = buildHmmTransition(40)
    const alpha: HmmAlpha = [0.25, 0.25, 0.25, 0.25]
    const result = hmmForward(alpha, A, 0, 2)
    const sum = result.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 5)
    result.forEach((p) => expect(p).toBeGreaterThanOrEqual(0))
  })
})

describe('hmmToClockPos', () => {
  it('returns value in [0, 1)', () => {
    const pos = hmmToClockPos([0.9, 0.03, 0.04, 0.03])
    expect(pos).toBeGreaterThanOrEqual(0)
    expect(pos).toBeLessThan(1)
  })
})
