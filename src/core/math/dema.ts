/**
 * Double Exponential Moving Average (DEMA).
 *
 * DEMA = 2 * EMA(period) - EMA(EMA(period))
 *
 * Reduces lag compared to a simple EMA while maintaining smoothness.
 */
export function dema(
  values: number[],
  period: number,
): number[] {
  const n = values.length
  if (n === 0 || period < 1) return []

  const alpha = 2 / (period + 1)
  const ema1 = new Array<number>(n)
  const ema2 = new Array<number>(n)
  const out = new Array<number>(n)

  ema1[0] = values[0]!
  ema2[0] = values[0]!

  for (let i = 1; i < n; i++) {
    ema1[i] = alpha * values[i]! + (1 - alpha) * ema1[i - 1]!
    ema2[i] = alpha * ema1[i]! + (1 - alpha) * ema2[i - 1]!
  }

  for (let i = 0; i < n; i++) {
    out[i] = 2 * ema1[i]! - ema2[i]!
  }

  return out
}
