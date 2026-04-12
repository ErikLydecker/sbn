import { CANVAS_COLORS as C } from '@/config/theme'
import { drawDensityField } from './density-field'

const ACCENT_RGB = [113, 112, 255] as const
const DIM_RGB = [30, 30, 50] as const

export function drawAttractor3d(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pts: number[][],
  azimuth: number,
  elevation: number,
): void {
  ctx.clearRect(0, 0, w, h)

  if (pts.length < 4) {
    ctx.fillStyle = C.mutedText
    ctx.font = '11px "Google Sans Code", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Awaiting embedding data\u2026', w / 2, h / 2)
    return
  }

  const cx = w / 2
  const cy = h / 2
  const margin = 30
  const scale = (Math.min(w, h) - margin * 2) / 2

  const projected = pts.map((p) => project3d(p as [number, number, number], azimuth, elevation))

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  for (const [x, y] of projected) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const fitScale = scale / Math.max(rangeX, rangeY) * 2
  const offsetX = (minX + maxX) / 2
  const offsetY = (minY + maxY) / 2

  const toScreen = (p: [number, number]): [number, number] => [
    cx + (p[0] - offsetX) * fitScale,
    cy + (p[1] - offsetY) * fitScale,
  ]

  const screen = projected.map((p) => toScreen(p))

  drawDensityField(ctx, w, h, screen as [number, number][], margin, margin)

  drawAxes(ctx, cx, cy, fitScale * 0.35, azimuth, elevation)

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
    ctx.lineWidth = 0.8 + t * 1.2
    ctx.stroke()
  }

  ctx.shadowColor = C.accent
  ctx.shadowBlur = 16
  ctx.strokeStyle = `rgba(113,112,255,0.4)`
  ctx.lineWidth = 2
  const tail = Math.max(0, n - Math.round(n * 0.08))
  ctx.beginPath()
  ctx.moveTo(screen[tail]![0], screen[tail]![1])
  for (let i = tail + 1; i < n; i++) {
    const [px, py] = screen[i - 1]!
    const [x1, y1] = screen[i]!
    const mx = (px + x1) / 2
    const my = (py + y1) / 2
    ctx.quadraticCurveTo(px, py, mx, my)
  }
  ctx.stroke()
  ctx.shadowBlur = 0

  const [lx, ly] = screen[n - 1]!
  ctx.beginPath()
  ctx.arc(lx, ly, 4, 0, Math.PI * 2)
  ctx.fillStyle = C.accent
  ctx.shadowColor = C.accent
  ctx.shadowBlur = 14
  ctx.fill()
  ctx.shadowBlur = 0
}

function project3d(
  p: [number, number, number],
  az: number,
  el: number,
): [number, number] {
  const ca = Math.cos(az), sa = Math.sin(az)
  const ce = Math.cos(el), se = Math.sin(el)
  const x = ca * p[0] + sa * p[2]
  const y = se * (sa * p[0] - ca * p[2]) + ce * p[1]
  return [x, y]
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  len: number,
  az: number,
  el: number,
): void {
  const axes: { dir: [number, number, number]; label: string }[] = [
    { dir: [1, 0, 0], label: 'PC1' },
    { dir: [0, 1, 0], label: 'PC2' },
    { dir: [0, 0, 1], label: 'PC3' },
  ]

  ctx.font = '8px "Google Sans Code", monospace'
  ctx.textAlign = 'center'

  const axisOriginX = cx - (ctx.canvas.width / ctx.getTransform().a) * 0.5 + 40
  const axisOriginY = cy + (ctx.canvas.height / ctx.getTransform().d) * 0.5 - 40

  for (const { dir, label } of axes) {
    const [ex, ey] = project3d(dir as [number, number, number], az, el)
    const tx = axisOriginX + ex * len
    const ty = axisOriginY + ey * len

    ctx.beginPath()
    ctx.moveTo(axisOriginX, axisOriginY)
    ctx.lineTo(tx, ty)
    ctx.strokeStyle = C.majorTick
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = C.mutedText
    ctx.fillText(label, tx + (ex > 0 ? 8 : -8), ty + (ey > 0 ? 10 : -4))
  }
}
