import { TRADING_CONFIG } from '@/config/trading'
import type { RegimeId } from '@/schemas/regime'
import type { HmmAlpha } from '@/core/dsp/hmm'

export function classifyRegime(hmmAlpha: HmmAlpha, kappa: number): RegimeId {
  const phase = hmmAlpha.indexOf(Math.max(...hmmAlpha))
  const highK = kappa >= TRADING_CONFIG.kappaThreshold
  return (phase * 2 + (highK ? 0 : 1)) as RegimeId
}

/**
 * Maps regime to expected trade direction.
 * RISING -> LONG (1), PEAK -> SHORT (-1), FALLING -> SHORT (-1), TROUGH -> LONG (1)
 */
export function regimeDirection(regimeId: RegimeId): 1 | -1 {
  const phase = Math.floor(regimeId / 2)
  return ([1, -1, -1, 1] as const)[phase]!
}
