import { besselI0 } from '@/core/math/bessel'
import { DSP_CONFIG } from '@/config/dsp'

export interface VmFilterResult {
  mu: number
  kappa: number
  rBar: number
}

export function vmPdf(theta: number, kappa: number, mu: number): number {
  const k = Math.max(kappa, 0.01)
  return Math.exp(k * Math.cos(theta - mu)) / (2 * Math.PI * besselI0(k))
}

export function kappaFromRbar(r: number): number {
  const rr = Math.min(Math.max(r, 0.001), 0.9999)
  if (rr < 0.53) return 2 * rr + rr ** 3 + (5 / 6) * rr ** 5
  if (rr < 0.85) return -0.4 + 1.39 * rr + 0.43 / (1 - rr)
  return 1 / (rr ** 3 - 4 * rr ** 2 + 3 * rr)
}

/**
 * Von Mises exponential filter.
 * Lambda = forgetting factor. Effective horizon ~ 1/lambda samples.
 */
export function vmFilter(phases: number[], lambda: number): VmFilterResult {
  let ss = 0, sc = 0, wsum = 0
  const n = phases.length

  for (let i = 0; i < n; i++) {
    const age = n - 1 - i
    const w = Math.exp(-lambda * age)
    ss += w * Math.sin(phases[i]!)
    sc += w * Math.cos(phases[i]!)
    wsum += w
  }

  if (wsum < 1e-12) return { mu: 0, kappa: 0.1, rBar: 0 }

  const rBar = Math.hypot(ss, sc) / wsum
  const mu = Math.atan2(ss / wsum, sc / wsum)
  return {
    mu,
    kappa: Math.min(kappaFromRbar(rBar), DSP_CONFIG.vonMises.maxKappa),
    rBar,
  }
}
