import { describe, it, expect } from 'vitest'
import { vmPdf, kappaFromRbar, vmFilter } from './von-mises'

describe('vmPdf', () => {
  it('is non-negative everywhere', () => {
    for (let theta = -Math.PI; theta <= Math.PI; theta += 0.1) {
      expect(vmPdf(theta, 2, 0)).toBeGreaterThanOrEqual(0)
    }
  })

  it('peaks at mu', () => {
    const mu = 1.5
    const atMu = vmPdf(mu, 5, mu)
    const awayFromMu = vmPdf(mu + 1, 5, mu)
    expect(atMu).toBeGreaterThan(awayFromMu)
  })
})

describe('kappaFromRbar', () => {
  it('returns higher kappa for higher R-bar', () => {
    const k1 = kappaFromRbar(0.3)
    const k2 = kappaFromRbar(0.7)
    expect(k2).toBeGreaterThan(k1)
  })
})

describe('vmFilter', () => {
  it('returns coherent result for consistent phases', () => {
    const phases = new Array(50).fill(Math.PI / 4) as number[]
    const { rBar } = vmFilter(phases, 0.1)
    expect(rBar).toBeGreaterThan(0.9)
  })

  it('returns lower coherence for scattered phases', () => {
    const consistent = new Array(50).fill(0) as number[]
    const scattered = Array.from({ length: 50 }, (_, i) => (i / 50) * 2 * Math.PI)
    const { rBar: consistentR } = vmFilter(consistent, 0.1)
    const { rBar: scatteredR } = vmFilter(scattered, 0.1)
    expect(scatteredR).toBeLessThan(consistentR)
  })
})
