/**
 * Compute a 2D density field from screen-space points and render it
 * as a glow heatmap onto a canvas. The density reveals the attractor --
 * bright regions are where the trajectory spends time (the invariant set),
 * dim regions are transient passages.
 */

const GRID = 80

export function drawDensityField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  screenPts: [number, number][],
  padX = 30,
  padY = 30,
): void {
  if (screenPts.length < 8) return

  const plotW = w - padX * 2
  const plotH = h - padY * 2
  if (plotW < 10 || plotH < 10) return

  const cellW = plotW / GRID
  const cellH = plotH / GRID

  const grid = new Float32Array(GRID * GRID)

  for (const [sx, sy] of screenPts) {
    const gx = (sx - padX) / cellW
    const gy = (sy - padY) / cellH
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    if (ix < 0 || ix >= GRID || iy < 0 || iy >= GRID) continue

    const fx = gx - ix
    const fy = gy - iy

    const idx = iy * GRID + ix
    grid[idx] = grid[idx]! + (1 - fx) * (1 - fy)
    if (ix + 1 < GRID) grid[idx + 1] = grid[idx + 1]! + fx * (1 - fy)
    if (iy + 1 < GRID) grid[idx + GRID] = grid[idx + GRID]! + (1 - fx) * fy
    if (ix + 1 < GRID && iy + 1 < GRID) grid[idx + GRID + 1] = grid[idx + GRID + 1]! + fx * fy
  }

  gaussBlur(grid, GRID, GRID, 2.5)

  let maxVal = 0
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]! > maxVal) maxVal = grid[i]!
  }
  if (maxVal < 1e-6) return

  const img = ctx.createImageData(GRID, GRID)
  const data = img.data

  for (let i = 0; i < grid.length; i++) {
    const t = grid[i]! / maxVal
    const intensity = Math.pow(t, 0.6)
    const off = i * 4
    data[off] = Math.round(113 * intensity)
    data[off + 1] = Math.round(112 * intensity)
    data[off + 2] = Math.round(255 * intensity)
    data[off + 3] = Math.round(intensity * 140)
  }

  const offCanvas = new OffscreenCanvas(GRID, GRID)
  const offCtx = offCanvas.getContext('2d')!
  offCtx.putImageData(img, 0, 0)

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(offCanvas, padX, padY, plotW, plotH)
}

function gaussBlur(grid: Float32Array, w: number, h: number, sigma: number): void {
  const radius = Math.ceil(sigma * 3)
  const kernel = new Float32Array(radius * 2 + 1)
  let sum = 0
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma))
    kernel[i + radius] = v
    sum += v
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] = kernel[i]! / sum

  const tmp = new Float32Array(w * h)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.min(Math.max(x + k, 0), w - 1)
        s += grid[y * w + sx]! * kernel[k + radius]!
      }
      tmp[y * w + x] = s
    }
  }

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let s = 0
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.min(Math.max(y + k, 0), h - 1)
        s += tmp[sy * w + x]! * kernel[k + radius]!
      }
      grid[y * w + x] = s
    }
  }
}
