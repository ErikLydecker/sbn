import { CANVAS_COLORS as C } from '@/config/theme'

interface PolarPoint {
  phase: number
  kappa: number
}

const GRID_R = 40
const GRID_TH = 72

export function drawPolarRose(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pts: PolarPoint[],
  color: string,
  maxKappa: number,
): void {
  ctx.clearRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.42

  drawPolarGrid(ctx, cx, cy, R)

  if (pts.length < 4) {
    ctx.fillStyle = C.mutedText
    ctx.font = '10px "Google Sans Code", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('No data for this regime', cx, cy)
    return
  }

  const normK = maxKappa > 0.01 ? maxKappa : 1

  drawDensityLayer(ctx, cx, cy, R, pts, normK, color)
  drawTrajectory(ctx, cx, cy, R, pts, normK, color)

  const last = pts[pts.length - 1]!
  const lr = (last.kappa / normK) * R
  const lx = cx + Math.cos(last.phase) * lr
  const ly = cy + Math.sin(last.phase) * lr
  ctx.beginPath()
  ctx.arc(lx, ly, 3.5, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 10
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawPolarGrid(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
): void {
  for (const frac of [0.25, 0.5, 0.75, 1.0]) {
    ctx.beginPath()
    ctx.arc(cx, cy, R * frac, 0, Math.PI * 2)
    ctx.strokeStyle = frac === 1 ? C.ring100 : C.ring25
    ctx.lineWidth = 1
    ctx.stroke()
  }

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
    ctx.strokeStyle = C.ring25
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.font = '7px "Google Sans Code", monospace'
  ctx.fillStyle = C.mutedText
  ctx.textAlign = 'center'
  const labels: [number, string][] = [
    [-Math.PI / 2, '0\u00b0'],
    [0, '90\u00b0'],
    [Math.PI / 2, '180\u00b0'],
    [Math.PI, '270\u00b0'],
  ]
  for (const [a, l] of labels) {
    ctx.fillText(l, cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10) + 3)
  }
}

function drawDensityLayer(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  pts: PolarPoint[],
  normK: number,
  color: string,
): void {
  const grid = new Float32Array(GRID_R * GRID_TH)

  for (const { phase, kappa } of pts) {
    const rNorm = Math.min(kappa / normK, 1)
    const ri = Math.floor(rNorm * (GRID_R - 1))
    let th = ((phase + Math.PI) / (2 * Math.PI)) * GRID_TH
    if (th < 0) th += GRID_TH
    const ti = Math.floor(th) % GRID_TH
    const idx = ri * GRID_TH + ti
    grid[idx] = grid[idx]! + 1
  }

  blurPolarGrid(grid, GRID_R, GRID_TH, 1.5)

  let maxVal = 0
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]! > maxVal) maxVal = grid[i]!
  }
  if (maxVal < 0.01) return

  const rgb = parseColor(color)

  for (let ri = 0; ri < GRID_R; ri++) {
    for (let ti = 0; ti < GRID_TH; ti++) {
      const val = grid[ri * GRID_TH + ti]!
      if (val < 0.01) continue

      const intensity = Math.pow(val / maxVal, 0.5)
      const r1 = (ri / GRID_R) * R
      const r2 = ((ri + 1) / GRID_R) * R
      const th1 = (ti / GRID_TH) * Math.PI * 2 - Math.PI
      const th2 = ((ti + 1) / GRID_TH) * Math.PI * 2 - Math.PI

      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(th1) * r1, cy + Math.sin(th1) * r1)
      ctx.arc(cx, cy, r2, th1, th2)
      ctx.lineTo(cx + Math.cos(th2) * r1, cy + Math.sin(th2) * r1)
      ctx.arc(cx, cy, r1, th2, th1, true)
      ctx.closePath()

      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(intensity * 0.35).toFixed(2)})`
      ctx.fill()
    }
  }
}

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  pts: PolarPoint[],
  normK: number,
  color: string,
): void {
  const rgb = parseColor(color)
  const n = pts.length
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const toXY = (p: PolarPoint): [number, number] => {
    const r = Math.min(p.kappa / normK, 1) * R
    return [cx + Math.cos(p.phase) * r, cy + Math.sin(p.phase) * r]
  }

  const screen = pts.map(toXY)

  for (let i = 0; i < n - 1; i++) {
    const t = i / (n - 1)
    const alpha = 0.05 + 0.3 * t

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

    ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(2)})`
    ctx.lineWidth = 0.6 + t * 0.8
    ctx.stroke()
  }
}

function blurPolarGrid(grid: Float32Array, nr: number, nth: number, sigma: number): void {
  const radius = Math.ceil(sigma * 2)
  const kernel = new Float32Array(radius * 2 + 1)
  let sum = 0
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma))
    kernel[i + radius] = v
    sum += v
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] = kernel[i]! / sum

  const tmp = new Float32Array(nr * nth)
  for (let r = 0; r < nr; r++) {
    for (let t = 0; t < nth; t++) {
      let s = 0
      for (let k = -radius; k <= radius; k++) {
        const st = ((t + k) % nth + nth) % nth
        s += grid[r * nth + st]! * kernel[k + radius]!
      }
      tmp[r * nth + t] = s
    }
  }
  for (let t = 0; t < nth; t++) {
    for (let r = 0; r < nr; r++) {
      let s = 0
      for (let k = -radius; k <= radius; k++) {
        const sr = Math.min(Math.max(r + k, 0), nr - 1)
        s += tmp[sr * nth + t]! * kernel[k + radius]!
      }
      grid[r * nth + t] = s
    }
  }
}

function parseColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}
