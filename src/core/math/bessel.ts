/**
 * Modified Bessel function of the first kind, order 0.
 * Polynomial approximation from Abramowitz & Stegun.
 */
export function besselI0(x: number): number {
  const ax = Math.abs(x)
  if (ax < 3.75) {
    const t = x / 3.75
    const t2 = t * t
    return 1 + t2 * (3.5156229 + t2 * (3.0899424 + t2 * (1.2067492 + t2 * (0.2659732 + t2 * (0.0360768 + t2 * 0.0045813)))))
  }
  const t = 3.75 / ax
  return (Math.exp(ax) / Math.sqrt(ax)) *
    (0.39894228 + t * (0.01328592 + t * (0.00225319 + t * (-0.00157565 + t * (0.00916281 + t * (-0.02057706 + t * (0.02635537 + t * (-0.01647633 + t * 0.00392377))))))))
}
