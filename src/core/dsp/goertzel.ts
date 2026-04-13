import type { FrequencyBin } from '@/schemas/analysis'

export interface GoertzelPeak {
  k: number
  kFrac: number
  amp: number
  confidence: number
}

export interface GoertzelBankOptions {
  persistenceDecay?: number
  persistenceThreshold?: number
  persistenceWeight?: number
  harmonicThreshold?: number
}

/**
 * Given a spectrum of amplitudes (0-indexed, bin i corresponds to k=i+1),
 * check whether the peak at `peakIdx` is actually a harmonic of a lower
 * fundamental that also carries significant energy.
 * Returns the resolved fundamental index (0-based).
 */
export function resolveHarmonic(
  amps: Float64Array | number[],
  peakIdx: number,
  threshold: number,
): number {
  const peakAmp = amps[peakIdx]!
  if (peakAmp <= 0) return peakIdx

  const peakK = peakIdx + 1
  for (const divisor of [2, 3]) {
    const subK = Math.round(peakK / divisor)
    if (subK < 1) continue
    const subIdx = subK - 1
    if (subIdx >= amps.length) continue
    if (amps[subIdx]! >= threshold * peakAmp) {
      return subIdx
    }
  }
  return peakIdx
}

/**
 * Exponentially-weighted Goertzel bank for causal frequency tracking.
 *
 * Maintains per-bin complex accumulators that decay by `lambda` on each
 * new sample, producing an incrementally-updated spectrum equivalent to
 * a DFT with an exponentially-decaying window.
 *
 * Tracks per-bin persistence (how long each bin stays near the top) and
 * uses harmonic grouping to prefer fundamentals over overtones.
 *
 * Complexity: O(maxK) per push, no batch recompute.
 */
export class GoertzelBank {
  private readonly maxK: number
  private readonly refLen: number
  private readonly lambda: number
  private readonly subBin: boolean

  private readonly pDecay: number
  private readonly pThreshold: number
  private readonly pWeight: number
  private readonly hThreshold: number

  private readonly cosTable: Float64Array
  private readonly sinTable: Float64Array
  private re: Float64Array
  private im: Float64Array
  private persistence: Float64Array
  private phase: number
  private _sampleCount: number

  constructor(
    maxK: number,
    refLength: number,
    lambda: number,
    subBinInterp = true,
    opts: GoertzelBankOptions = {},
  ) {
    this.maxK = maxK
    this.refLen = refLength
    this.lambda = lambda
    this.subBin = subBinInterp

    this.pDecay = opts.persistenceDecay ?? 0.98
    this.pThreshold = opts.persistenceThreshold ?? 0.6
    this.pWeight = opts.persistenceWeight ?? 0.3
    this.hThreshold = opts.harmonicThreshold ?? 0.35

    this.cosTable = new Float64Array(maxK)
    this.sinTable = new Float64Array(maxK)
    for (let i = 0; i < maxK; i++) {
      const k = i + 1
      const w = (2 * Math.PI * k) / refLength
      this.cosTable[i] = Math.cos(w)
      this.sinTable[i] = Math.sin(w)
    }

    this.re = new Float64Array(maxK)
    this.im = new Float64Array(maxK)
    this.persistence = new Float64Array(maxK)
    this.phase = 0
    this._sampleCount = 0
  }

  get sampleCount(): number {
    return this._sampleCount
  }

  push(x: number): void {
    const w0 = (2 * Math.PI * this.phase) / this.refLen
    for (let i = 0; i < this.maxK; i++) {
      const k = i + 1
      const angle = k * w0
      this.re[i] = this.lambda * this.re[i]! + x * Math.cos(angle)
      this.im[i] = this.lambda * this.im[i]! - x * Math.sin(angle)
    }
    this.phase = (this.phase + 1) % this.refLen
    this._sampleCount++

    this._updatePersistence()
  }

  private _updatePersistence(): void {
    let maxAmp = 0
    for (let i = 0; i < this.maxK; i++) {
      const amp = Math.hypot(this.re[i]!, this.im[i]!)
      if (amp > maxAmp) maxAmp = amp
    }

    const decay = this.pDecay
    if (maxAmp < 1e-15) {
      for (let i = 0; i < this.maxK; i++) {
        this.persistence[i] = decay * this.persistence[i]!
      }
      return
    }

    const cutoff = this.pThreshold * maxAmp
    const rise = 1 - decay
    for (let i = 0; i < this.maxK; i++) {
      const amp = Math.hypot(this.re[i]!, this.im[i]!)
      if (amp >= cutoff) {
        this.persistence[i] = decay * this.persistence[i]! + rise
      } else {
        this.persistence[i] = decay * this.persistence[i]!
      }
    }
  }

  spectrum(): FrequencyBin[] {
    const norm = 1 - this.lambda
    const out: FrequencyBin[] = []
    for (let i = 0; i < this.maxK; i++) {
      const re = this.re[i]! * norm
      const im = this.im[i]! * norm
      out.push({ k: i + 1, re, im, amp: Math.hypot(re, im) })
    }
    return out
  }

  peakK(): GoertzelPeak {
    const rawAmps = new Float64Array(this.maxK)
    for (let i = 0; i < this.maxK; i++) {
      rawAmps[i] = Math.hypot(this.re[i]!, this.im[i]!)
    }

    let bestIdx = 0
    let bestScore = 0
    for (let i = 0; i < this.maxK; i++) {
      const score = rawAmps[i]! * (1 + this.pWeight * this.persistence[i]!)
      if (score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    }

    bestIdx = resolveHarmonic(rawAmps, bestIdx, this.hThreshold)

    const k = bestIdx + 1
    const norm = 1 - this.lambda
    const peakAmp = rawAmps[bestIdx]! * norm
    const confidence = this.persistence[bestIdx]!

    if (!this.subBin || bestIdx === 0 || bestIdx === this.maxK - 1) {
      return { k, kFrac: k, amp: peakAmp, confidence }
    }

    const aL = rawAmps[bestIdx - 1]!
    const aC = rawAmps[bestIdx]!
    const aR = rawAmps[bestIdx + 1]!

    const denom = aL - 2 * aC + aR
    if (Math.abs(denom) < 1e-12) {
      return { k, kFrac: k, amp: peakAmp, confidence }
    }

    const delta = 0.5 * (aL - aR) / denom
    const kFrac = k + Math.max(-0.5, Math.min(0.5, delta))

    return { k, kFrac, amp: peakAmp, confidence }
  }

  partialDecay(factor: number): void {
    for (let i = 0; i < this.maxK; i++) {
      this.re[i]! *= factor
      this.im[i]! *= factor
    }
  }

  reset(): void {
    this.re.fill(0)
    this.im.fill(0)
    this.persistence.fill(0)
    this.phase = 0
    this._sampleCount = 0
  }

  reseed(samples: number[]): void {
    this.reset()
    for (const x of samples) {
      this.push(x)
    }
  }

  serialize(): GoertzelBankSnapshot {
    return {
      re: Array.from(this.re),
      im: Array.from(this.im),
      persistence: Array.from(this.persistence),
      phase: this.phase,
      sampleCount: this._sampleCount,
    }
  }

  restore(snap: GoertzelBankSnapshot): void {
    const n = Math.min(snap.re.length, this.maxK)
    for (let i = 0; i < n; i++) {
      this.re[i] = snap.re[i]!
      this.im[i] = snap.im[i]!
      this.persistence[i] = snap.persistence[i]!
    }
    this.phase = snap.phase
    this._sampleCount = snap.sampleCount
  }
}

export interface GoertzelBankSnapshot {
  re: number[]
  im: number[]
  persistence: number[]
  phase: number
  sampleCount: number
}
