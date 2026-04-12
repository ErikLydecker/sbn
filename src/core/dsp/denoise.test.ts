import { describe, it, expect } from 'vitest'
import { causalDenoise } from './denoise'

const REF_LEN = 256

function makeSinusoid(n: number, k: number, refLen: number): number[] {
  return Array.from({ length: n }, (_, t) => Math.sin((2 * Math.PI * k * t) / refLen))
}

function addNoise(sig: number[], amplitude: number, seed = 42): number[] {
  let s = seed
  return sig.map((v) => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const u = (s / 0x7fffffff - 0.5) * 2
    return v + u * amplitude
  })
}

function rmsError(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += (a[i]! - b[i]!) ** 2
  }
  return Math.sqrt(sum / a.length)
}

describe('causalDenoise', () => {
  it('decomposition is strictly causal: extending signal does not change previous detail coefficients', () => {
    const sig = addNoise(makeSinusoid(200, 7, REF_LEN), 0.3)

    const out1 = causalDenoise(sig, 3, 0)
    const extended = [...sig, 0.5]
    const out2 = causalDenoise(extended, 3, 0)

    for (let i = 0; i < sig.length; i++) {
      expect(out2[i]).toBe(out1[i])
    }
  })

  it('reduces RMS error on noisy sinusoid', () => {
    const clean = makeSinusoid(400, 5, REF_LEN)
    const noisy = addNoise(clean, 0.5)

    const denoised = causalDenoise(noisy, 3, 0.8)

    const rmsBefore = rmsError(clean, noisy)
    const rmsAfter = rmsError(clean, denoised)

    expect(rmsAfter).toBeLessThan(rmsBefore)
  })

  it('preserves structure of clean sinusoid', () => {
    const clean = makeSinusoid(300, 8, REF_LEN)
    const denoised = causalDenoise(clean, 3, 0.8)

    const rms = rmsError(clean, denoised)
    expect(rms).toBeLessThan(0.1)
  })

  it('handles all-zero signal', () => {
    const zeros = new Array(100).fill(0) as number[]
    const result = causalDenoise(zeros, 3, 0.8)
    expect(result.length).toBe(100)
    for (const v of result) {
      expect(v).toBe(0)
    }
  })

  it('returns copy for signals shorter than 4 samples', () => {
    const short = [0.1, 0.2, 0.3]
    const result = causalDenoise(short, 3, 0.8)
    expect(result).toEqual(short)
    result[0] = 999
    expect(short[0]).toBe(0.1)
  })

  it('handles constant signal without error', () => {
    const constant = new Array(100).fill(0.5) as number[]
    const result = causalDenoise(constant, 3, 0.8)
    expect(result.length).toBe(100)
  })

  it('reduces noise variance on noisy signal', () => {
    const clean = makeSinusoid(500, 10, REF_LEN)
    const noisy = addNoise(clean, 0.4)
    const denoised = causalDenoise(noisy, 3, 0.8)

    let noisyVar = 0, denoisedVar = 0
    for (let i = 0; i < clean.length; i++) {
      noisyVar += (noisy[i]! - clean[i]!) ** 2
      denoisedVar += (denoised[i]! - clean[i]!) ** 2
    }

    expect(denoisedVar).toBeLessThan(noisyVar)
  })

  it('output length matches input length', () => {
    const sig = makeSinusoid(150, 6, REF_LEN)
    for (const levels of [1, 2, 3, 4, 5]) {
      const result = causalDenoise(sig, levels, 1.0)
      expect(result.length).toBe(sig.length)
    }
  })

  it('higher threshold removes more noise', () => {
    const clean = makeSinusoid(400, 5, REF_LEN)
    const noisy = addNoise(clean, 0.5)

    const gentle = causalDenoise(noisy, 3, 0.3)
    const aggressive = causalDenoise(noisy, 3, 1.5)

    let gentleDiff = 0, aggressiveDiff = 0
    for (let i = 0; i < noisy.length; i++) {
      gentleDiff += Math.abs(noisy[i]! - gentle[i]!)
      aggressiveDiff += Math.abs(noisy[i]! - aggressive[i]!)
    }

    expect(aggressiveDiff).toBeGreaterThan(gentleDiff)
  })

  it('thresholding more levels increases smoothing', () => {
    const noisy = addNoise(makeSinusoid(400, 5, REF_LEN), 0.5)

    const oneLevel = causalDenoise(noisy, 4, 0.8, 1)
    const twoLevels = causalDenoise(noisy, 4, 0.8, 2)

    let diff1 = 0, diff2 = 0
    for (let i = 0; i < noisy.length; i++) {
      diff1 += Math.abs(noisy[i]! - oneLevel[i]!)
      diff2 += Math.abs(noisy[i]! - twoLevels[i]!)
    }

    expect(diff2).toBeGreaterThan(diff1)
  })

  it('with zero threshold multiplier, output equals input (no thresholding)', () => {
    const sig = addNoise(makeSinusoid(200, 7, REF_LEN), 0.3)
    const result = causalDenoise(sig, 3, 0)

    for (let i = 0; i < sig.length; i++) {
      expect(result[i]).toBeCloseTo(sig[i]!, 10)
    }
  })
})
