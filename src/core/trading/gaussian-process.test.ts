import { describe, it, expect } from 'vitest'
import { createGp, gpAddObservation, gpPredict } from './gaussian-process'

describe('GaussianProcess', () => {
  it('returns high variance with no observations', () => {
    const gp = createGp()
    const { variance } = gpPredict(gp, [0.5, 0.5, 0.5, 0.5, 0.5])
    expect(variance).toBeCloseTo(1.0, 1)
  })

  it('reduces variance near observed points', () => {
    const gp = createGp()
    const x = [0.5, 0.5, 0.5, 0.5, 0.5]
    gpAddObservation(gp, x, 1.0)

    const { variance: nearVariance } = gpPredict(gp, [0.5, 0.5, 0.5, 0.5, 0.5])
    const { variance: farVariance } = gpPredict(gp, [0.1, 0.1, 0.1, 0.1, 0.1])
    expect(nearVariance).toBeLessThan(farVariance)
  })

  it('mean approximates observed value near observation', () => {
    const gp = createGp()
    gpAddObservation(gp, [0.5, 0.5, 0.5, 0.5, 0.5], 2.0)
    const { mean } = gpPredict(gp, [0.5, 0.5, 0.5, 0.5, 0.5])
    expect(mean).toBeCloseTo(2.0, 0)
  })
})
