import type { FrequencyBin } from '@/schemas/analysis'
import { CANVAS_COLORS as C } from '@/config/theme'

export function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  freqs: FrequencyBin[],
  domK: number,
): void {
  ctx.clearRect(0, 0, w, h)
  if (!freqs.length) return

  const top = freqs.slice(0, Math.min(48, freqs.length))
  const mx = Math.max(...top.map((f) => f.amp), 0.0001)
  const bw = w / top.length

  top.forEach((f, i) => {
    const fr = f.amp / mx
    const bh2 = fr * (h - 12)
    const a = 0.15 + fr * 0.85
    ctx.fillStyle = `rgba(113,112,255,${a.toFixed(2)})`
    ctx.fillRect(i * bw + 1, h - bh2, bw - 2, bh2)
  })

  const di = top.findIndex((f) => f.k === domK)
  if (di >= 0) {
    const px = di * bw + bw / 2
    ctx.strokeStyle = 'rgba(208,214,224,.9)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 4])
    ctx.beginPath()
    ctx.moveTo(px, 0)
    ctx.lineTo(px, h)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = C.gold
    ctx.font = '8px "Google Sans Code", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('k=' + domK, Math.min(Math.max(px, 16), w - 16), 10)
  }
}
