/**
 * Construct Takens delay-coordinate embedding vectors.
 */
export function takensEmbed(sig: number[], dim: number, tau: number): number[][] {
  const n = sig.length
  const span = (dim - 1) * tau
  if (n <= span) return []

  const vecs: number[][] = []
  for (let t = span; t < n; t++) {
    const v = new Array(dim) as number[]
    for (let d = 0; d < dim; d++) {
      v[d] = sig[t - d * tau]!
    }
    vecs.push(v)
  }
  return vecs
}
