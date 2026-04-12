import { CANVAS_COLORS as C } from '@/config/theme'
import { drawDensityField } from './density-field'

const ACCENT_RGB = [113, 112, 255] as const
const DIM_RGB = [30, 30, 50] as const

export function drawAttractor2d(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pts: number[][],
): void {
  ctx.clearRect(0, 0, w, h)

  if (pts.length < 4) {
    ctx.fillStyle = C.mutedText
    ctx.font = '11px "Google Sans Code", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Awaiting embedding data\u2026', w / 2, h / 2)
    return
  }

  const margin = 30
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p[0]! < minX) minX = p[0]!
    if (p[0]! > maxX) maxX = p[0]!
    if (p[1]! < minY) minY = p[1]!
    if (p[1]! > maxY) maxY = p[1]!
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const drawW = w - margin * 2
  const drawH = h - margin * 2
  const scaleVal = Math.min(drawW / rangeX, drawH / rangeY)

  const cx = w / 2
  const cy = h / 2
  const offX = (minX + maxX) / 2
  const offY = (minY + maxY) / 2

  const toScreen = (x: number, y: number): [number, number] => [
    cx + (x - offX) * scaleVal,
    cy + (y - offY) * scaleVal,
  ]

  ctx.strokeStyle = C.ring25
  ctx.lineWidth = 1
  ctx.beginPath()
  const [axLx] = toScreen(minX, 0)
  const [axRx] = toScreen(maxX, 0)
  const [, axTy] = toScreen(0, minY)
  const [, axBy] = toScreen(0, maxY)
  ctx.moveTo(axLx, cy)
  ctx.lineTo(axRx, cy)
  ctx.moveTo(cx, axTy)
  ctx.lineTo(cx, axBy)
  ctx.stroke()

  ctx.font = '8px "Google Sans Code", monospace'
  ctx.fillStyle = C.mutedText
  ctx.textAlign = 'center'
  ctx.fillText('PC1', axRx + 2, cy - 5)
  ctx.fillText('PC2', cx + 14, axBy + 3)

  const screen = pts.map((p) => toScreen(p[0]!, p[1]!))

  drawDensityField(ctx, w, h, screen as [number, number][], margin, margin)
  const n = screen.length
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let i = 0; i < n - 1; i++) {
    const t = i / (n - 1)
    const r = Math.round(DIM_RGB[0] + (ACCENT_RGB[0] - DIM_RGB[0]) * t)
    const g = Math.round(DIM_RGB[1] + (ACCENT_RGB[1] - DIM_RGB[1]) * t)
    const b = Math.round(DIM_RGB[2] + (ACCENT_RGB[2] - DIM_RGB[2]) * t)
    const alpha = 0.15 + 0.6 * t

    const [x0, y0] = screen[i]!
    const [x1, y1] = screen[i + 1]!
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2

    ctx.beginPath()
    if (i === 0) {
      ctx.moveTo(x0, y0)
      ctx.lineTo(mx, my)
    } else {
      const [px, py] = screen[i - 1]!
      const pmx = (px + x0) / 2
      const pmy = (py + y0) / 2
      ctx.moveTo(pmx, pmy)
      ctx.quadraticCurveTo(x0, y0, mx, my)
    }

    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`
    ctx.lineWidth = 0.8 + t
    ctx.stroke()
  }

  ctx.shadowColor = C.accent
  ctx.shadowBlur = 14
  ctx.strokeStyle = `rgba(113,112,255,0.4)`
  ctx.lineWidth = 2
  const tail = Math.max(0, n - Math.round(n * 0.08))
  ctx.beginPath()
  ctx.moveTo(screen[tail]![0], screen[tail]![1])
  for (let i = tail + 1; i < n; i++) {
    const [px, py] = screen[i - 1]!
    const [x1, y1] = screen[i]!
    const mx2 = (px + x1) / 2
    const my2 = (py + y1) / 2
    ctx.quadraticCurveTo(px, py, mx2, my2)
  }
  ctx.stroke()
  ctx.shadowBlur = 0

  const [lx, ly] = screen[n - 1]!
  ctx.beginPath()
  ctx.arc(lx, ly, 3.5, 0, Math.PI * 2)
  ctx.fillStyle = C.accent
  ctx.shadowColor = C.accent
  ctx.shadowBlur = 10
  ctx.fill()
  ctx.shadowBlur = 0
}
