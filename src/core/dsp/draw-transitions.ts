import { CANVAS_COLORS as C } from '@/config/theme'
import { REGIME_DEFINITIONS } from '@/schemas/regime'

const ACCENT: [number, number, number] = [113, 112, 255]

export function drawTransitions(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  matrix: number[],
): void {
  ctx.clearRect(0, 0, w, h)

  const active: number[] = []
  for (let i = 0; i < 8; i++) {
    let hasData = false
    for (let j = 0; j < 8; j++) {
      if (matrix[i * 8 + j]! > 0 || matrix[j * 8 + i]! > 0) { hasData = true; break }
    }
    if (hasData) active.push(i)
  }

  const n = active.length
  if (n === 0) {
    ctx.fillStyle = C.mutedText
    ctx.font = '11px "Google Sans Code", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Awaiting transition data\u2026', w / 2, h / 2)
    return
  }

  const labelW = 62
  const labelH = 18
  const pad = 4
  const plotW = w - labelW - pad * 2
  const plotH = h - labelH - pad * 2
  const cellW = plotW / n
  const cellH = plotH / n
  const ox = labelW + pad
  const oy = labelH + pad

  let maxVal = 0
  for (let ri = 0; ri < n; ri++) {
    for (let ci = 0; ci < n; ci++) {
      const v = matrix[active[ri]! * 8 + active[ci]!]!
      if (v > maxVal) maxVal = v
    }
  }

  for (let ri = 0; ri < n; ri++) {
    for (let ci = 0; ci < n; ci++) {
      const val = matrix[active[ri]! * 8 + active[ci]!]!
      const x = ox + ci * cellW
      const y = oy + ri * cellH

      if (val > 0 && maxVal > 0) {
        const t = Math.pow(Math.min(val / maxVal, 1), 0.55)
        const alpha = 0.06 + 0.7 * t
        ctx.fillStyle = `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${alpha.toFixed(2)})`
        ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1)

        if (cellW > 14) {
          ctx.fillStyle = t > 0.4 ? '#f7f8f8' : `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},0.7)`
          ctx.font = `${Math.min(10, Math.floor(cellH * 0.4))}px "Google Sans Code", monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(`${val}`, x + cellW / 2, y + cellH / 2)
        }
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(x, y, cellW, cellH)
    }
  }

  ctx.font = '8px "Google Sans Code", monospace'
  for (let i = 0; i < n; i++) {
    const def = REGIME_DEFINITIONS[active[i]!]!
    const label = shortLabel(def.name)

    ctx.fillStyle = `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${def.highCoherence ? 1 : 0.55})`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, ox - 4, oy + i * cellH + cellH / 2)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(label, ox + i * cellW + cellW / 2, oy - 4)
  }

  ctx.strokeStyle = C.ring100
  ctx.lineWidth = 1
  ctx.strokeRect(ox, oy, plotW, plotH)
}

function shortLabel(name: string): string {
  const parts = name.split('\u00b7')
  const phase = parts[0]!.slice(0, 3)
  const coh = (parts[1] ?? '').trim()
  return `${phase}\u00b7${coh}`
}
