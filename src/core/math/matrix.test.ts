import { describe, it, expect } from 'vitest'
import { matInv, matVec } from './matrix'

describe('matVec', () => {
  it('computes matrix-vector product', () => {
    const M = [[1, 2], [3, 4]]
    const v = [5, 6]
    expect(matVec(M, v)).toEqual([17, 39])
  })
})

describe('matInv', () => {
  it('inverts 2x2 identity', () => {
    const I = [[1, 0], [0, 1]]
    const result = matInv(I)
    expect(result[0]![0]).toBeCloseTo(1)
    expect(result[0]![1]).toBeCloseTo(0)
    expect(result[1]![0]).toBeCloseTo(0)
    expect(result[1]![1]).toBeCloseTo(1)
  })

  it('inverts 2x2 matrix correctly', () => {
    const M = [[2, 1], [5, 3]]
    const inv = matInv(M)
    // M * M^-1 should equal I
    // Column 0 of M^-1
    const col0 = matVec(M, [inv[0]![0]!, inv[1]![0]!])
    const col1 = matVec(M, [inv[0]![1]!, inv[1]![1]!])
    expect(col0[0]).toBeCloseTo(1)
    expect(col0[1]).toBeCloseTo(0)
    expect(col1[0]).toBeCloseTo(0)
    expect(col1[1]).toBeCloseTo(1)
  })
})
