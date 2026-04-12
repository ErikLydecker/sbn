import { dft } from './dft'
import { resolveHarmonic } from './goertzel'
import { DSP_CONFIG } from '@/config/dsp'

/**
 * Estimate the dominant period in event-bar units.
 * Applies a Hann taper before DFT to reduce spectral leakage,
 * picks highest-amplitude k (with harmonic resolution),
 * converts to period = n/k.
 */
export function estimateTdom(sig: number[]): number {
  const { minPeriod, maxPeriod, fallback } = DSP_CONFIG.tDom

  if (sig.length < 16) return fallback

  const n = sig.length
  const tapered = sig.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))))
  const freqs = dft(tapered)
  if (freqs.length === 0) return fallback

  const amps = freqs.map((f) => f.amp)

  let peakIdx = 0
  for (let i = 1; i < amps.length; i++) {
    if (amps[i]! > amps[peakIdx]!) peakIdx = i
  }

  const resolvedIdx = resolveHarmonic(amps, peakIdx, DSP_CONFIG.goertzel.harmonicThreshold)
  const domK = resolvedIdx + 1
  const tDom = Math.round(n / domK)

  return Math.max(minPeriod, Math.min(maxPeriod, tDom))
}
