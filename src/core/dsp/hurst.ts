/**
 * Rescaled-range (R/S) Hurst exponent estimation.
 *
 * H < 0.5 → mean-reverting / anti-persistent (cyclic regime)
 * H = 0.5 → random walk
 * H > 0.5 → trending / persistent
 */
export function computeHurst(
  series: number[],
  minWindow = 8,
  maxWindow?: number,
): number {
  const n = series.length
  if (n < minWindow * 2) return 0.5

  const maxW = maxWindow ?? Math.floor(n / 2)
  const logN: number[] = []
  const logRS: number[] = []

  let w = minWindow
  while (w <= maxW) {
    const chunks = Math.floor(n / w)
    if (chunks < 1) break

    let rsSum = 0
    let validChunks = 0

    for (let c = 0; c < chunks; c++) {
      const start = c * w
      let mean = 0
      for (let i = 0; i < w; i++) mean += series[start + i]!
      mean /= w

      let cumDev = 0
      let minDev = 0
      let maxDev = 0
      let varSum = 0

      for (let i = 0; i < w; i++) {
        const d = series[start + i]! - mean
        cumDev += d
        if (cumDev < minDev) minDev = cumDev
        if (cumDev > maxDev) maxDev = cumDev
        varSum += d * d
      }

      const range = maxDev - minDev
      const std = Math.sqrt(varSum / w)
      if (std > 1e-12) {
        rsSum += range / std
        validChunks++
      }
    }

    if (validChunks > 0) {
      logN.push(Math.log(w))
      logRS.push(Math.log(rsSum / validChunks))
    }

    w = Math.max(w + 1, Math.round(w * 1.3))
  }

  if (logN.length < 3) return 0.5

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  const m = logN.length
  for (let i = 0; i < m; i++) {
    sumX += logN[i]!
    sumY += logRS[i]!
    sumXY += logN[i]! * logRS[i]!
    sumXX += logN[i]! * logN[i]!
  }

  const denom = m * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-12) return 0.5

  const slope = (m * sumXY - sumX * sumY) / denom
  return Math.max(0, Math.min(1, slope))
}
