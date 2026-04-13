import { besselI0 } from '@/core/math/bessel'
import { circDiff } from '@/core/math/circular'
import { DSP_CONFIG } from '@/config/dsp'

export interface VmFilterResult {
  mu: number
  kappa: number
  /** Residual rBar: coherence after removing expected phase advance (cycle quality) */
  rBar: number
  /** Raw rBar: arc concentration without demodulation */
  rawRBar: number
  /** Pairwise Phase Consistency: bias-free coherence (Vinck et al. 2010). E[PPC]=0 under null. */
  ppc: number
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
 * Von Mises exponential filter with phase demodulation.
 *
 * Raw phases advance through the cycle at ~2*pi/tDom per sample.
 * Without demodulation, rBar measures arc concentration and is capped
 * by the arc swept within the horizon window.
 *
 * Demodulation subtracts the expected phase advance so rBar measures
 * how tightly phases track the ideal cycle — true coherence.
 *
 * @param phases - Raw phase angles from Takens embedding
 * @param lambda - Forgetting factor (effective horizon ~ 1/lambda)
 * @param tDom   - Dominant period in samples; 0 disables demodulation
 */
export function vmFilter(phases: number[], lambda: number, tDom = 0): VmFilterResult {
  const n = phases.length
  if (n < 2) return { mu: 0, kappa: 0.1, rBar: 0, rawRBar: 0, ppc: 0 }

  // Raw (un-demodulated) circular mean for absolute phase position
  let rawSs = 0, rawSc = 0, rawWsum = 0
  for (let i = 0; i < n; i++) {
    const age = n - 1 - i
    const w = Math.exp(-lambda * age)
    rawSs += w * Math.sin(phases[i]!)
    rawSc += w * Math.cos(phases[i]!)
    rawWsum += w
  }

  if (rawWsum < 1e-12) return { mu: 0, kappa: 0.1, rBar: 0, rawRBar: 0, ppc: 0 }

  const rawRBar = Math.hypot(rawSs, rawSc) / rawWsum
  const mu = Math.atan2(rawSs / rawWsum, rawSc / rawWsum)

  // Demodulated residual coherence via cumulative phase increments.
  // Each step: actual advance (via circDiff) minus expected advance (omega).
  // Accumulating the deviation avoids branch-cut issues from raw subtraction
  // and adapts better if tDom breathes within the window.
  let rBar: number
  if (tDom > 0) {
    const omega = (2 * Math.PI) / tDom
    let resSs = 0, resSc = 0, resWsum = 0
    let cumResidual = 0
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        const increment = circDiff(phases[i]!, phases[i - 1]!)
        cumResidual += increment - omega
      }
      const age = n - 1 - i
      const w = Math.exp(-lambda * age)
      resSs += w * Math.sin(cumResidual)
      resSc += w * Math.cos(cumResidual)
      resWsum += w
    }
    rBar = resWsum > 1e-12 ? Math.hypot(resSs, resSc) / resWsum : 0
  } else {
    rBar = rawRBar
  }

  // Kish's effective sample size for weighted data: N_eff = (sum w)^2 / sum(w^2)
  let wSumSq = 0
  for (let i = 0; i < n; i++) {
    const age = n - 1 - i
    const w = Math.exp(-lambda * age)
    wSumSq += w * w
  }
  const nEff = wSumSq > 1e-12 ? (rawWsum * rawWsum) / wSumSq : n

  // PPC = (N * R^2 - 1) / (N - 1), unbiased under the null (Vinck et al. 2010)
  const ppc = nEff > 1 ? Math.max(0, (nEff * rBar * rBar - 1) / (nEff - 1)) : 0

  return {
    mu,
    kappa: Math.min(kappaFromRbar(rBar), DSP_CONFIG.vonMises.maxKappa),
    rBar,
    rawRBar,
    ppc,
  }
}
