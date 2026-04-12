import { DSP_CONFIG } from '@/config/dsp'

/**
 * Estimate embedding dimension via kurtosis heuristic.
 * Higher kurtosis indicates richer attractor requiring more dimensions.
 */
export function estimateDim(sig: number[], _tau: number, maxDim?: number): number {
  const cap = maxDim ?? DSP_CONFIG.embedding.maxDim
  const n = sig.length
  const mu = sig.reduce((a, b) => a + b, 0) / n
  const s2 = sig.reduce((a, b) => a + (b - mu) ** 2, 0) / n
  const k4 = sig.reduce((a, b) => a + (b - mu) ** 4, 0) / n
  const kurt = s2 > 1e-12 ? k4 / (s2 * s2) : 3

  if (kurt > DSP_CONFIG.embedding.kurtosisHighThreshold) return Math.min(cap, 6)
  if (kurt > DSP_CONFIG.embedding.kurtosisMedThreshold) return Math.min(cap, 5)
  return Math.min(cap, 4)
}
