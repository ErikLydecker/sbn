import { CANVAS_COLORS as C } from '@/config/theme'

export function drawRecurrence(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  matrix: number[],
  size: number,
): void {
  ctx.clearRect(0, 0, w, h)

  if (size < 2 || matrix.length < 4) {
    ctx.fillStyle = C.mutedText
    ctx.font = '11px "Google Sans Code", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Awaiting recurrence data\u2026', w / 2, h / 2)
    return
  }

  const margin = 24
  const plotSize = Math.min(w, h) - margin * 2
  const cellSize = plotSize / size
  const ox = (w - plotSize) / 2
  const oy = (h - plotSize) / 2

  ctx.fillStyle = C.bg
  ctx.fillRect(ox, oy, plotSize, plotSize)

  ctx.strokeStyle = C.ring100
  ctx.lineWidth = 1
  ctx.strokeRect(ox, oy, plotSize, plotSize)

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (matrix[i * size + j]) {
        const t = Math.max(i, j) / (size - 1)
        const alpha = 0.3 + 0.5 * t
        ctx.fillStyle = `rgba(113,112,255,${alpha.toFixed(2)})`

        if (cellSize >= 2) {
          ctx.fillRect(
            ox + j * cellSize,
            oy + i * cellSize,
            Math.max(cellSize - 0.5, 1),
            Math.max(cellSize - 0.5, 1),
          )
        } else {
          ctx.fillRect(
            ox + j * cellSize,
            oy + i * cellSize,
            1,
            1,
          )
        }
      }
    }
  }

  ctx.font = '8px "Google Sans Code", monospace'
  ctx.fillStyle = C.mutedText
  ctx.textAlign = 'center'
  ctx.fillText('t\u2081', ox + plotSize / 2, oy + plotSize + 14)
  ctx.save()
  ctx.translate(ox - 10, oy + plotSize / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('t\u2082', 0, 0)
  ctx.restore()
}
