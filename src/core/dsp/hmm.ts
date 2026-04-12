import { vmPdf } from './von-mises'
import { DSP_CONFIG } from '@/config/dsp'

const { statePhaseCentres } = DSP_CONFIG.hmm

export type HmmAlpha = [number, number, number, number]

/**
 * Build 4x4 HMM transition matrix from dominant period.
 * Expected dwell per state = Tdom/4 (four states per cycle).
 * Only forward transitions allowed.
 */
export function buildHmmTransition(tDom: number): number[][] {
  const D = Math.max(DSP_CONFIG.hmm.minDwell, Math.round(tDom / 4))
  const ps = Math.max(0.5, 1 - 1 / D)
  const pf = 1 - ps

  return [
    [ps, pf, 0, 0],
    [0, ps, pf, 0],
    [0, 0, ps, pf],
    [pf, 0, 0, ps],
  ]
}

/**
 * Single HMM forward step.
 * Returns updated state probabilities.
 */
export function hmmForward(
  alphaPrev: HmmAlpha,
  A: number[][],
  observedPhase: number,
  kappa: number,
): HmmAlpha {
  const nS = 4
  const pred = new Array(nS).fill(0) as number[]

  for (let j = 0; j < nS; j++) {
    for (let i = 0; i < nS; i++) {
      pred[j]! += alphaPrev[i]! * A[i]![j]!
    }
  }

  const upd = pred.map(
    (p, j) => p * vmPdf(observedPhase, Math.max(kappa, 0.3), statePhaseCentres[j]!),
  )

  const sum = upd.reduce((a, b) => a + b, 0)
  if (sum < 1e-20) return [...alphaPrev]

  return upd.map((x) => x / sum) as HmmAlpha
}

/**
 * Convert HMM alpha probabilities to a clock position [0, 1).
 */
export function hmmToClockPos(alpha: HmmAlpha): number {
  let ss = 0, sc = 0
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    ss += alpha[i]! * Math.sin(a)
    sc += alpha[i]! * Math.cos(a)
  }
  return ((Math.atan2(ss, sc) / (Math.PI * 2)) + 1) % 1
}
