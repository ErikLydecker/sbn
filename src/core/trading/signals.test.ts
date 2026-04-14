import { describe, it, expect } from 'vitest'
import { computeCrs, shouldEnter } from './signals'
import type { ClockSnapshot } from './engine'
import type { HmmAlpha } from '@/core/dsp/hmm'

function makeSnapshot(overrides: Partial<ClockSnapshot> = {}): ClockSnapshot {
  return {
    alpha: [0.7, 0.1, 0.1, 0.1] as HmmAlpha,
    kappa: 2.0,
    rBar: 0.6,
    ppc: 0.1,
    hurst: 0.5,
    clockPos: 0.25,
    price: 75000,
    tDom: 40,
    topologyScore: 0.5,
    topologyClass: 'stable_loop',
    morphologySpecies: 0,
    curvatureConcentration: 0.5,
    recurrenceRate: 0.1,
    structureScore: 0.6,
    h1Peak: 0.2,
    h1Persistence: 0.3,
    fragmentationRate: 0.1,
    torsionEnergy: 0.05,
    subspaceStability: 0.7,
    ...overrides,
  }
}

describe('computeCrs', () => {
  it('returns a composite between 0 and 1 for typical inputs', () => {
    const result = computeCrs(makeSnapshot(), 0.01, 5, 0)
    expect(result.composite).toBeGreaterThan(0)
    expect(result.composite).toBeLessThanOrEqual(1)
  })

  it('returns low composite when all signals are near zero', () => {
    const weak = makeSnapshot({
      kappa: 0.05,
      ppc: 0,
      hurst: 0.5,
      topologyScore: 0,
      recurrenceRate: 0,
      structureScore: 0,
      curvatureConcentration: 0,
      h1Peak: 0,
      torsionEnergy: 0,
      subspaceStability: 0,
      alpha: [0.25, 0.25, 0.25, 0.25] as HmmAlpha,
    })
    const result = computeCrs(weak, 0.001, 0, 0)
    expect(result.composite).toBeLessThan(0.2)
  })

  it('returns high composite when all signals are strong', () => {
    const strong = makeSnapshot({
      kappa: 4.0,
      ppc: 0.3,
      topologyScore: 0.8,
      recurrenceRate: 0.2,
      structureScore: 0.8,
      curvatureConcentration: 0.7,
      h1Peak: 0.5,
      torsionEnergy: 0.1,
      subspaceStability: 0.9,
      alpha: [0.85, 0.05, 0.05, 0.05] as HmmAlpha,
    })
    const result = computeCrs(strong, 0.02, 10, 0)
    expect(result.composite).toBeGreaterThan(0.5)
  })

  it('all group scores are between 0 and 1', () => {
    const result = computeCrs(makeSnapshot(), 0.01, 5, 0)
    expect(result.coherence).toBeGreaterThanOrEqual(0)
    expect(result.coherence).toBeLessThanOrEqual(1)
    expect(result.regime).toBeGreaterThanOrEqual(0)
    expect(result.regime).toBeLessThanOrEqual(1)
    expect(result.topology).toBeGreaterThanOrEqual(0)
    expect(result.topology).toBeLessThanOrEqual(1)
    expect(result.geometry).toBeGreaterThanOrEqual(0)
    expect(result.geometry).toBeLessThanOrEqual(1)
    expect(result.trend).toBeGreaterThanOrEqual(0)
    expect(result.trend).toBeLessThanOrEqual(1)
  })

  it('high hurst boosts trend-phase (RISING=0) CRS', () => {
    const trendSnap = makeSnapshot({ hurst: 0.8 })
    const neutralSnap = makeSnapshot({ hurst: 0.5 })
    const trendResult = computeCrs(trendSnap, 0.01, 5, 0)
    const neutralResult = computeCrs(neutralSnap, 0.01, 5, 0)
    expect(trendResult.trend).toBeGreaterThan(neutralResult.trend)
  })

  it('low hurst boosts turning-phase (PEAK=1) CRS', () => {
    const cyclicSnap = makeSnapshot({ hurst: 0.3 })
    const trendSnap = makeSnapshot({ hurst: 0.8 })
    const cyclicResult = computeCrs(cyclicSnap, 0.01, 5, 1)
    const trendResult = computeCrs(trendSnap, 0.01, 5, 1)
    expect(cyclicResult.trend).toBeGreaterThan(trendResult.trend)
  })

  it('high hurst penalizes turning-phase entries relative to low hurst', () => {
    const highHurst = makeSnapshot({ hurst: 0.8 })
    const lowHurst = makeSnapshot({ hurst: 0.3 })
    const highResult = computeCrs(highHurst, 0.01, 5, 1)
    const lowResult = computeCrs(lowHurst, 0.01, 5, 1)
    expect(highResult.trend).toBeLessThan(lowResult.trend)
  })

  it('single strong group does not produce high composite alone', () => {
    const weak = makeSnapshot({
      kappa: 0.05,
      ppc: 0,
      topologyScore: 0.9,
      recurrenceRate: 0.3,
      structureScore: 0.9,
      curvatureConcentration: 0,
      h1Peak: 0,
      torsionEnergy: 0,
      subspaceStability: 0,
      alpha: [0.25, 0.25, 0.25, 0.25] as HmmAlpha,
    })
    const result = computeCrs(weak, 0.001, 0, 0)
    expect(result.topology).toBeGreaterThan(0.5)
    expect(result.composite).toBeLessThan(0.4)
  })
})

describe('shouldEnter', () => {
  it('blocks entry during cooldown', () => {
    const cooldowns = [5, 0, 0, 0, 0, 0, 0, 0]
    const params = [0.01, 0.1, 0.02, 0.3, 10, 0.5]
    const snap = makeSnapshot()
    const { enter } = shouldEnter(0, 0.02, 0.01, snap, params, cooldowns, 5)
    expect(enter).toBe(false)
  })

  it('blocks entry with wrong direction', () => {
    const cooldowns = new Array(8).fill(0) as number[]
    const params = [0.01, 0.1, 0.02, 0.3, 10, 0.5]
    const snap = makeSnapshot()
    // regimeId 0 = RISING phase -> expects positive vel
    const { enter } = shouldEnter(0, -0.02, -0.01, snap, params, cooldowns, 5)
    expect(enter).toBe(false)
  })

  it('allows entry with strong signals and correct direction', () => {
    const cooldowns = new Array(8).fill(0) as number[]
    const params = [0.005, 0.1, 0.02, 0.3, 10, 0.5]
    const snap = makeSnapshot({
      kappa: 3.0,
      ppc: 0.15,
      topologyScore: 0.7,
      recurrenceRate: 0.15,
      structureScore: 0.7,
      curvatureConcentration: 0.6,
      h1Peak: 0.3,
      torsionEnergy: 0.05,
      subspaceStability: 0.8,
      alpha: [0.8, 0.07, 0.07, 0.06] as HmmAlpha,
    })
    const { enter, crs } = shouldEnter(0, 0.02, 0.01, snap, params, cooldowns, 8)
    expect(enter).toBe(true)
    expect(crs).toBeGreaterThan(0)
  })

  it('returns CRS value even when entry is blocked', () => {
    const cooldowns = [5, 0, 0, 0, 0, 0, 0, 0]
    const params = [0.01, 0.1, 0.02, 0.3, 10, 0.5]
    const snap = makeSnapshot()
    const { enter, crs } = shouldEnter(0, 0.02, 0.01, snap, params, cooldowns, 5)
    expect(enter).toBe(false)
    expect(crs).toBe(0)
  })

  it('requires acceleration confirmation at turning phases', () => {
    const cooldowns = new Array(8).fill(0) as number[]
    const params = [0.005, 0.1, 0.02, 0.3, 10, 0.5]
    const snap = makeSnapshot({
      kappa: 3.0,
      ppc: 0.15,
      alpha: [0.05, 0.8, 0.1, 0.05] as HmmAlpha,
    })
    // regimeId 2 = PEAK high-kappa -> dir = -1, needs negative vel and accel
    const { enter: noAccel } = shouldEnter(2, -0.02, 0.01, snap, params, cooldowns, 8)
    expect(noAccel).toBe(false)
    const { enter: withAccel } = shouldEnter(2, -0.02, -0.01, snap, params, cooldowns, 8)
    expect(withAccel).toBe(true)
  })
})
