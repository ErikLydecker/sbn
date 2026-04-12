import { DSP_CONFIG } from '@/config/dsp'

/**
 * Average Mutual Information between x(t) and x(t+lag) using 2D histogram.
 * Fraser & Swinney (1986); bin count per Kantz & Schreiber sqrt(N) heuristic.
 */
function computeAMI(sig: number[], lag: number, numBins: number): number {
  const n = sig.length - lag
  if (n < numBins) return 0

  let min = Infinity, max = -Infinity
  for (let i = 0; i < sig.length; i++) {
    if (sig[i]! < min) min = sig[i]!
    if (sig[i]! > max) max = sig[i]!
  }

  const range = max - min
  if (range < 1e-12) return 0
  const binWidth = range / numBins

  const toBin = (v: number) => Math.min(numBins - 1, Math.floor((v - min) / binWidth))

  const joint = new Float64Array(numBins * numBins)
  const margX = new Float64Array(numBins)
  const margY = new Float64Array(numBins)

  for (let t = 0; t < n; t++) {
    const bx = toBin(sig[t]!)
    const by = toBin(sig[t + lag]!)
    const ji = bx * numBins + by
    joint[ji] = joint[ji]! + 1
    margX[bx] = margX[bx]! + 1
    margY[by] = margY[by]! + 1
  }

  let mi = 0
  for (let i = 0; i < numBins; i++) {
    const px = margX[i]! / n
    if (px < 1e-15) continue
    for (let j = 0; j < numBins; j++) {
      const pxy = joint[i * numBins + j]! / n
      if (pxy < 1e-15) continue
      const py = margY[j]! / n
      mi += pxy * Math.log(pxy / (px * py))
    }
  }

  return mi
}

/**
 * First lag where autocorrelation crosses zero.
 * Abarbanel: useful lower bound for tau to prevent pathologically small values.
 */
function autoCorrelationZeroCrossing(sig: number[], maxLag: number): number {
  const n = sig.length
  let mu = 0
  for (let i = 0; i < n; i++) mu += sig[i]!
  mu /= n

  let c0 = 0
  for (let i = 0; i < n; i++) c0 += (sig[i]! - mu) ** 2
  c0 /= n

  if (c0 < 1e-12) return 1

  for (let lag = 1; lag <= maxLag; lag++) {
    let c = 0
    for (let t = 0; t < n - lag; t++) {
      c += (sig[t]! - mu) * (sig[t + lag]! - mu)
    }
    c /= n - lag
    if (c <= 0) return lag
  }

  return maxLag
}

/**
 * Estimate embedding delay via first minimum of Average Mutual Information,
 * floored by the autocorrelation zero-crossing.
 *
 * Fraser & Swinney (1986), Kantz & Schreiber "Nonlinear Time Series Analysis".
 */
export function estimateTau(sig: number[], maxTau?: number): number {
  const n = sig.length
  const { minTau, amiBins: configBins } = DSP_CONFIG.tau
  const cap = maxTau ?? Math.max(2, Math.floor(n / 8))

  if (n < 16) return minTau

  const numBins = configBins ?? Math.max(8, Math.floor(Math.sqrt(n)))

  const ami = new Float64Array(cap + 1)
  for (let lag = 1; lag <= cap; lag++) {
    ami[lag] = computeAMI(sig, lag, numBins)
  }

  let amiMin = -1
  for (let lag = 2; lag < cap; lag++) {
    if (ami[lag]! < ami[lag - 1]! && ami[lag]! < ami[lag + 1]!) {
      amiMin = lag
      break
    }
  }

  const zeroCross = autoCorrelationZeroCrossing(sig, cap)

  if (amiMin > 0) {
    return Math.max(minTau, Math.max(amiMin, zeroCross))
  }

  return Math.max(minTau, Math.max(zeroCross, Math.floor(cap / 2)))
}
