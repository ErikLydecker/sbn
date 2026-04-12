export function detrend(a: number[]): number[] {
  const n = a.length
  if (n < 2) return a.slice()

  let sx = 0, sy = 0, sxy = 0, sx2 = 0
  for (let i = 0; i < n; i++) {
    sx += i
    sy += a[i]!
    sxy += i * a[i]!
    sx2 += i * i
  }

  const den = n * sx2 - sx * sx
  if (Math.abs(den) < 1e-12) {
    const mean = sy / n
    return a.map((v) => v - mean)
  }

  const m = (n * sxy - sx * sy) / den
  const b = (sy - m * sx) / n
  return a.map((v, i) => v - (m * i + b))
}
