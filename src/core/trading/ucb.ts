import { gpPredict, type GpModel } from './gaussian-process'
import { TRADING_CONFIG } from '@/config/trading'

/**
 * UCB acquisition: score = mean + beta * sqrt(variance).
 * Explores param space via random candidates.
 */
export function ucbAcquire(gp: GpModel, nCandidates?: number): number[] {
  const n = nCandidates ?? TRADING_CONFIG.ucbCandidates
  const beta = Math.max(
    TRADING_CONFIG.ucb.minBeta,
    TRADING_CONFIG.ucb.baseBeta - gp.X.length * TRADING_CONFIG.ucb.betaDecayRate,
  )

  let bestScore = -Infinity
  let bestX: number[] = Array.from(
    { length: TRADING_CONFIG.paramBounds.length },
    () => Math.random(),
  )

  for (let i = 0; i < n; i++) {
    const x = Array.from(
      { length: TRADING_CONFIG.paramBounds.length },
      () => Math.random(),
    )
    const { mean, variance } = gpPredict(gp, x)
    const score = mean + beta * Math.sqrt(variance)
    if (score > bestScore) {
      bestScore = score
      bestX = x
    }
  }

  return bestX
}

export function decodeParams(xNorm: number[]): number[] {
  return xNorm.map((v, i) => {
    const bounds = TRADING_CONFIG.paramBounds[i]!
    return bounds[0] + v * (bounds[1] - bounds[0])
  })
}
