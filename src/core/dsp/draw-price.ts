import type { OhlcBar } from '@/services/ohlc/aggregator'
import { CANVAS_COLORS as C } from '@/config/theme'

export function drawPriceChart(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  candles: OhlcBar[],
): void {
  ctx.clearRect(0, 0, w, h)
  if (candles.length < 2) return

  ctx.strokeStyle = C.gridLine
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = (i / 4) * h
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  let mn = Infinity
  let mx = -Infinity
  for (const bar of candles) {
    if (bar.low < mn) mn = bar.low
    if (bar.high > mx) mx = bar.high
  }
  const rng = mx - mn || 1
  const py = (v: number) => h - ((v - mn) / rng) * (h * 0.88) - h * 0.06

  const n = candles.length
  const gap = 1
  const candleW = Math.max(1, (w - gap * (n + 1)) / n)
  const bodyW = Math.max(1, candleW * 0.7)
  const wickW = Math.max(1, Math.min(candleW * 0.15, 2))

  for (let i = 0; i < n; i++) {
    const bar = candles[i]!
    const cx = gap + i * (candleW + gap) + candleW / 2
    const bull = bar.close >= bar.open

    const wickTop = py(bar.high)
    const wickBot = py(bar.low)
    ctx.beginPath()
    ctx.moveTo(cx, wickTop)
    ctx.lineTo(cx, wickBot)
    ctx.strokeStyle = bull ? 'rgba(113,112,255,.5)' : 'rgba(138,143,152,.5)'
    ctx.lineWidth = wickW
    ctx.stroke()

    const bodyTop = py(Math.max(bar.open, bar.close))
    const bodyBot = py(Math.min(bar.open, bar.close))
    const bodyH = Math.max(1, bodyBot - bodyTop)
    if (bull) {
      ctx.fillStyle = 'rgba(113,112,255,.7)'
    } else {
      ctx.fillStyle = 'rgba(138,143,152,.7)'
    }
    ctx.fillRect(cx - bodyW / 2, bodyTop, bodyW, bodyH)
  }

  const lastClose = candles[n - 1]!.close
  const cp = py(lastClose)
  ctx.beginPath()
  ctx.moveTo(0, cp)
  ctx.lineTo(w, cp)
  ctx.strokeStyle = C.dottedLine
  ctx.lineWidth = 1
  ctx.setLineDash([3, 5])
  ctx.stroke()
  ctx.setLineDash([])
}
