import type { FrequencyBin } from '@/schemas/analysis'
import { DSP_CONFIG } from '@/config/dsp'

export function dft(sig: number[]): FrequencyBin[] {
  const n = sig.length
  const maxK = Math.min(Math.floor(n / 2), DSP_CONFIG.raw.maxDftK)
  const out: FrequencyBin[] = []

  for (let k = 1; k <= maxK; k++) {
    let re = 0, im = 0
    for (let t = 0; t < n; t++) {
      const a = (2 * Math.PI * k * t) / n
      re += sig[t]! * Math.cos(a)
      im += sig[t]! * Math.sin(a)
    }
    re /= n
    im /= n
    out.push({ k, re, im, amp: Math.hypot(re, im) })
  }

  return out
}
