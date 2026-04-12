export interface CoherenceResult {
  rBar: number
  meanPhase: number
}

export function coherence(sig: number[], k: number): CoherenceResult {
  const n = sig.length
  let ss = 0, sc = 0

  for (let t = 0; t < n; t++) {
    const a = (2 * Math.PI * k * t) / n
    const ph = Math.atan2(-sig[t]! * Math.sin(a), sig[t]! * Math.cos(a))
    ss += Math.sin(ph)
    sc += Math.cos(ph)
  }

  return {
    rBar: Math.hypot(ss / n, sc / n),
    meanPhase: Math.atan2(ss / n, sc / n),
  }
}
