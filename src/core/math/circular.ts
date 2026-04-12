export function circDiff(a: number, b: number): number {
  return (((a - b) + Math.PI * 3) % (Math.PI * 2)) - Math.PI
}

export function wrapAngle(angle: number): number {
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
}
