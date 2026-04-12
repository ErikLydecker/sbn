/**
 * Causal Haar wavelet denoiser with MAD-based soft thresholding.
 *
 * Strictly causal decomposition: detail coefficient at index i depends
 * only on indices <= i. Thresholding targets only the finest detail level
 * where noise concentrates, preserving cycle structure in coarser levels.
 *
 * MAD (Median Absolute Deviation) provides a robust noise scale estimate
 * resistant to heavy-tailed returns and outliers.
 */

/**
 * Denoise a signal using a causal Haar wavelet transform with soft thresholding.
 *
 * @param signal - Input signal (e.g. log returns)
 * @param levels - Number of decomposition levels (typically 3-4).
 *   Only the finest `thresholdLevels` levels are thresholded; coarser levels
 *   pass through untouched to preserve cycle structure.
 * @param thresholdMultiplier - Scaling factor for the universal threshold.
 *   1.0 = standard VisuShrink, lower = gentler (keeps more detail).
 * @param thresholdLevels - How many fine levels to threshold (default: 1).
 *   Level 0 = finest (bar-to-bar jitter), level 1 = scale-2 noise, etc.
 * @returns Denoised signal of the same length
 */
export function causalDenoise(
  signal: number[],
  levels: number,
  thresholdMultiplier: number,
  thresholdLevels = 1,
): number[] {
  const n = signal.length
  if (n < 4 || levels < 1) return signal.slice()

  const approx = signal.slice()
  const details: number[][] = []

  for (let lvl = 0; lvl < levels; lvl++) {
    const step = 1 << lvl
    if (step >= n) break
    const detail = new Array<number>(n).fill(0)
    const nextApprox = approx.slice()
    for (let i = step; i < n; i++) {
      const avg = (approx[i]! + approx[i - step]!) / 2
      detail[i] = approx[i]! - avg
      nextApprox[i] = avg
    }
    details.push(detail)
    for (let i = step; i < n; i++) {
      approx[i] = nextApprox[i]!
    }
  }

  if (details.length === 0) return signal.slice()

  const sigma = estimateNoiseSigma(details[0]!)
  if (sigma < 1e-15) return signal.slice()

  const baseThresh = thresholdMultiplier * sigma * Math.sqrt(2 * Math.log(n))

  const levelsToThresh = Math.min(thresholdLevels, details.length)
  for (let lvl = 0; lvl < levelsToThresh; lvl++) {
    const detail = details[lvl]!
    const levelThresh = baseThresh / Math.sqrt(1 << lvl)
    for (let i = 0; i < n; i++) {
      const v = detail[i]!
      detail[i] = Math.sign(v) * Math.max(0, Math.abs(v) - levelThresh)
    }
  }

  const out = approx.slice()
  for (const detail of details) {
    for (let i = 0; i < n; i++) {
      out[i]! += detail[i]!
    }
  }
  return out
}

/**
 * Estimate noise standard deviation from the finest wavelet detail level
 * using the MAD (Median Absolute Deviation) estimator.
 * MAD / 0.6745 is the standard robust sigma estimator for Gaussian noise.
 */
function estimateNoiseSigma(finestDetail: number[]): number {
  const absVals: number[] = []
  for (let i = 0; i < finestDetail.length; i++) {
    if (finestDetail[i]! !== 0) absVals.push(Math.abs(finestDetail[i]!))
  }
  if (absVals.length === 0) return 0
  absVals.sort((a, b) => a - b)
  const mad = absVals[Math.floor(absVals.length / 2)]!
  return mad / 0.6745
}
