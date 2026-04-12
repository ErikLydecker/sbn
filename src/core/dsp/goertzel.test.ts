import { describe, it, expect } from 'vitest'
import { GoertzelBank, resolveHarmonic } from './goertzel'
import { dft } from './dft'

const REF_LEN = 256
const MAX_K = 48
const LAMBDA = 0.985

function makeSinusoid(n: number, k: number, refLen: number): number[] {
  return Array.from({ length: n }, (_, t) => Math.sin((2 * Math.PI * k * t) / refLen))
}

describe('GoertzelBank', () => {
  it('detects dominant frequency in pure sinusoid', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)
    const k = 7
    const sig = makeSinusoid(400, k, REF_LEN)
    for (const x of sig) bank.push(x)

    const peak = bank.peakK()
    expect(peak.k).toBe(k)
    expect(peak.amp).toBeGreaterThan(0)
  })

  it('returns correct number of bins from spectrum()', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)
    const sig = makeSinusoid(200, 5, REF_LEN)
    for (const x of sig) bank.push(x)

    const spec = bank.spectrum()
    expect(spec.length).toBe(MAX_K)
    expect(spec[0]).toHaveProperty('k')
    expect(spec[0]).toHaveProperty('re')
    expect(spec[0]).toHaveProperty('im')
    expect(spec[0]).toHaveProperty('amp')
  })

  it('provides sub-bin precision for fractional frequencies', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)
    const trueK = 5.3
    const sig = Array.from({ length: 500 }, (_, t) =>
      Math.sin((2 * Math.PI * trueK * t) / REF_LEN),
    )
    for (const x of sig) bank.push(x)

    const peak = bank.peakK()
    expect(peak.k).toBe(5)
    expect(Math.abs(peak.kFrac - trueK)).toBeLessThan(0.15)
  })

  it('tracks frequency change via exponential decay', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)
    const k1 = 5
    const k2 = 12

    const phase1 = makeSinusoid(300, k1, REF_LEN)
    for (const x of phase1) bank.push(x)
    expect(bank.peakK().k).toBe(k1)

    const convergenceLen = Math.ceil(3 / (1 - LAMBDA))
    const phase2 = makeSinusoid(convergenceLen, k2, REF_LEN)
    for (const x of phase2) bank.push(x)
    expect(bank.peakK().k).toBe(k2)
  })

  it('approximates batch DFT with high lambda', () => {
    const highLambda = 0.9999
    const bank = new GoertzelBank(MAX_K, REF_LEN, highLambda, false)
    const n = REF_LEN

    const sig = makeSinusoid(n, 8, REF_LEN)
    for (const x of sig) bank.push(x)

    const goertzelSpec = bank.spectrum()
    const batchSpec = dft(sig)

    const goertzelPeak = goertzelSpec.slice().sort((a, b) => b.amp - a.amp)[0]!
    const batchPeak = batchSpec.slice().sort((a, b) => b.amp - a.amp)[0]!
    expect(goertzelPeak.k).toBe(batchPeak.k)
  })

  it('returns near-zero amplitudes for zero-mean constant signal', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)
    for (let i = 0; i < 200; i++) bank.push(0)

    const spec = bank.spectrum()
    for (const bin of spec) {
      expect(bin.amp).toBe(0)
    }
  })

  it('reset clears all state', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)
    const sig = makeSinusoid(200, 5, REF_LEN)
    for (const x of sig) bank.push(x)
    expect(bank.peakK().amp).toBeGreaterThan(0)

    bank.reset()
    expect(bank.sampleCount).toBe(0)
    const spec = bank.spectrum()
    for (const bin of spec) {
      expect(bin.amp).toBe(0)
    }
  })

  it('reseed reconstructs state from samples', () => {
    const bank1 = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)
    const bank2 = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)

    const sig = makeSinusoid(200, 10, REF_LEN)
    for (const x of sig) bank1.push(x)

    bank2.push(0)
    bank2.push(0)
    bank2.reseed(sig)

    expect(bank2.peakK().k).toBe(bank1.peakK().k)
    expect(Math.abs(bank2.peakK().amp - bank1.peakK().amp)).toBeLessThan(0.001)
  })

  it('tracks sampleCount correctly', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)
    expect(bank.sampleCount).toBe(0)

    bank.push(1)
    bank.push(2)
    bank.push(3)
    expect(bank.sampleCount).toBe(3)

    bank.reset()
    expect(bank.sampleCount).toBe(0)

    bank.reseed([1, 2, 3, 4, 5])
    expect(bank.sampleCount).toBe(5)
  })
})

describe('persistence scoring', () => {
  it('incumbent bin resists brief transient spike', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA, true, {
      persistenceDecay: 0.98,
      persistenceThreshold: 0.6,
      persistenceWeight: 0.3,
    })

    const k1 = 6
    const sig1 = makeSinusoid(400, k1, REF_LEN)
    for (const x of sig1) bank.push(x)
    expect(bank.peakK().k).toBe(k1)
    expect(bank.peakK().confidence).toBeGreaterThan(0.8)

    const k2 = 15
    const briefSpike = makeSinusoid(20, k2, REF_LEN).map((v) => v * 1.15)
    for (const x of briefSpike) bank.push(x)

    expect(bank.peakK().k).toBe(k1)
  })

  it('new frequency eventually takes over with enough bars', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA, true, {
      persistenceDecay: 0.98,
      persistenceThreshold: 0.6,
      persistenceWeight: 0.3,
    })

    const k1 = 6
    const sig1 = makeSinusoid(300, k1, REF_LEN)
    for (const x of sig1) bank.push(x)
    expect(bank.peakK().k).toBe(k1)

    const k2 = 15
    const convergenceLen = Math.ceil(4 / (1 - LAMBDA))
    const sig2 = makeSinusoid(convergenceLen, k2, REF_LEN)
    for (const x of sig2) bank.push(x)

    expect(bank.peakK().k).toBe(k2)
    expect(bank.peakK().confidence).toBeGreaterThan(0.5)
  })

  it('confidence starts at zero for a fresh bank', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)
    const sig = makeSinusoid(1, 5, REF_LEN)
    for (const x of sig) bank.push(x)
    expect(bank.peakK().confidence).toBeLessThan(0.1)
  })

  it('reset clears persistence', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)
    const sig = makeSinusoid(300, 5, REF_LEN)
    for (const x of sig) bank.push(x)
    expect(bank.peakK().confidence).toBeGreaterThan(0.5)

    bank.reset()
    bank.push(0)
    expect(bank.peakK().confidence).toBe(0)
  })
})

describe('harmonic resolution', () => {
  it('resolveHarmonic picks sub-harmonic when it has sufficient energy', () => {
    const amps = new Float64Array(48)
    amps[5] = 0.4
    amps[11] = 1.0
    const resolved = resolveHarmonic(amps, 11, 0.35)
    expect(resolved).toBe(5)
  })

  it('resolveHarmonic keeps peak when sub-harmonic is too weak', () => {
    const amps = new Float64Array(48)
    amps[5] = 0.1
    amps[11] = 1.0
    const resolved = resolveHarmonic(amps, 11, 0.35)
    expect(resolved).toBe(11)
  })

  it('resolveHarmonic handles edge case at k=1', () => {
    const amps = new Float64Array(48)
    amps[0] = 0.5
    amps[1] = 1.0
    const resolved = resolveHarmonic(amps, 1, 0.35)
    expect(resolved).toBe(0)
  })

  it('peakK prefers fundamental over harmonic in mixed signal', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA, true, {
      harmonicThreshold: 0.35,
      persistenceWeight: 0,
    })

    const fundamental = 6
    const harmonic = 12
    const sig = Array.from({ length: 500 }, (_, t) => {
      const f = Math.sin((2 * Math.PI * fundamental * t) / REF_LEN) * 0.5
      const h = Math.sin((2 * Math.PI * harmonic * t) / REF_LEN) * 1.0
      return f + h
    })
    for (const x of sig) bank.push(x)

    expect(bank.peakK().k).toBe(fundamental)
  })

  it('peakK keeps harmonic when fundamental has no energy', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA, true, {
      harmonicThreshold: 0.35,
      persistenceWeight: 0,
    })

    const harmonic = 12
    const sig = makeSinusoid(500, harmonic, REF_LEN)
    for (const x of sig) bank.push(x)

    expect(bank.peakK().k).toBe(harmonic)
  })
})

describe('partialDecay', () => {
  it('halves all bin amplitudes without resetting sampleCount or phase', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)
    const sig = makeSinusoid(300, 8, REF_LEN)
    for (const x of sig) bank.push(x)

    const ampBefore = bank.peakK().amp
    const countBefore = bank.sampleCount

    bank.partialDecay(0.5)

    expect(bank.sampleCount).toBe(countBefore)
    const ampAfter = bank.peakK().amp
    expect(ampAfter).toBeCloseTo(ampBefore * 0.5, 4)
  })

  it('preserves peak identity after partial decay', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA)
    const sig = makeSinusoid(300, 10, REF_LEN)
    for (const x of sig) bank.push(x)

    bank.partialDecay(0.5)

    expect(bank.peakK().k).toBe(10)
  })

  it('new samples accumulate correctly after partial decay', () => {
    const bank = new GoertzelBank(MAX_K, REF_LEN, LAMBDA, true, { persistenceWeight: 0 })
    const sig1 = makeSinusoid(300, 8, REF_LEN)
    for (const x of sig1) bank.push(x)
    expect(bank.peakK().k).toBe(8)

    bank.partialDecay(0.1)

    const sig2 = makeSinusoid(300, 20, REF_LEN)
    for (const x of sig2) bank.push(x)
    expect(bank.peakK().k).toBe(20)
  })
})
