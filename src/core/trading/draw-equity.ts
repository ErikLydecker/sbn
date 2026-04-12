import { CANVAS_COLORS as C } from '@/config/theme'

export function drawEquityCurve(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  curve: number[],
  initialEquity: number,
): void {
  ctx.clearRect(0, 0, w, h)
  if (curve.length < 2) return

  const mn = Math.min(...curve)
  const mx = Math.max(...curve)
  const rng = mx - mn || 1
  const py = (v: number) => h - ((v - mn) / rng) * (h * 0.88) - h * 0.06

  const zy = py(initialEquity)
  ctx.beginPath()
  ctx.moveTo(0, zy)
  ctx.lineTo(w, zy)
  ctx.strokeStyle = C.dim
  ctx.lineWidth = 1
  ctx.setLineDash([3, 5])
  ctx.stroke()
  ctx.setLineDash([])

  ctx.beginPath()
  curve.forEach((v, i) => {
    const x = (i / (curve.length - 1)) * w
    i === 0 ? ctx.moveTo(x, py(v)) : ctx.lineTo(x, py(v))
  })
  ctx.lineTo(w, zy)
  ctx.lineTo(0, zy)
  ctx.closePath()
  const isUp = curve[curve.length - 1]! >= initialEquity
  ctx.fillStyle = isUp ? 'rgba(113,112,255,0.08)' : 'rgba(138,143,152,0.08)'
  ctx.fill()

  ctx.beginPath()
  curve.forEach((v, i) => {
    const x = (i / (curve.length - 1)) * w
    i === 0 ? ctx.moveTo(x, py(v)) : ctx.lineTo(x, py(v))
  })
  ctx.strokeStyle = isUp ? C.rising : C.falling
  ctx.lineWidth = 1.5
  ctx.stroke()
}
