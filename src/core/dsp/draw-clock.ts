import { vmPdf } from './von-mises'
import { CANVAS_COLORS as C } from '@/config/theme'

export function drawClock(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pos: number,
  rBar: number,
  meanPhase: number,
  trail?: number[],
  kappa?: number,
  hmmAlpha?: readonly [number, number, number, number],
): void {
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.41
  const rCol = rBar > 0.6 ? C.rising : rBar > 0.3 ? C.falling : C.trough
  const rgb = rBar > 0.6 ? '113,112,255' : rBar > 0.3 ? '138,143,152' : '98,102,109'

  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    const isM = i % 9 === 0
    const r1 = R * (isM ? 0.82 : 0.88)
    const r2 = R * 0.95
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2)
    ctx.strokeStyle = isM ? C.majorTick : C.tickMark
    ctx.lineWidth = isM ? 1.5 : 1
    ctx.stroke()
  }

  ctx.font = '9px "Google Sans Code", monospace'
  ctx.fillStyle = C.mutedText
  ctx.textAlign = 'center'
  const cardinals: [number, string][] = [[-Math.PI / 2, '0°'], [0, '90°'], [Math.PI / 2, '180°'], [Math.PI, '270°']]
  for (const [a, l] of cardinals) {
    ctx.fillText(l, cx + Math.cos(a) * (R + 13), cy + Math.sin(a) * (R + 13) + 3)
  }

  if (kappa !== undefined && kappa > 0.3 && !isNaN(meanPhase)) {
    const steps = 180
    ctx.beginPath()
    let maxP = 0
    const pts: { th: number; p: number }[] = []
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI * 2 - Math.PI
      const p = vmPdf(th, kappa, meanPhase)
      maxP = Math.max(maxP, p)
      pts.push({ th, p })
    }
    pts.forEach(({ th, p }, i) => {
      const r = R * 0.15 + R * 0.78 * (p / maxP)
      const px2 = cx + Math.cos(th) * r
      const py2 = cy + Math.sin(th) * r
      i === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2)
    })
    ctx.closePath()
    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
    const al = Math.min(0.06 + kappa * 0.04, 0.35).toFixed(2)
    g2.addColorStop(0, `rgba(${rgb},${al})`)
    g2.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = g2
    ctx.fill()
    ctx.strokeStyle = `rgba(${rgb},${Math.min(0.12 + kappa * 0.06, 0.55).toFixed(2)})`
    ctx.lineWidth = 1
    ctx.stroke()
  }

  for (const r of [0.25, 0.5, 0.75, 1]) {
    ctx.beginPath()
    ctx.arc(cx, cy, R * r, 0, Math.PI * 2)
    ctx.strokeStyle = r === 1 ? C.ring100 : C.ring25
    ctx.lineWidth = 1
    ctx.stroke()
  }

  if (trail && trail.length > 1) {
    for (let i = 1; i < trail.length; i++) {
      const a1 = trail[i - 1]! * Math.PI * 2 - Math.PI / 2
      const a2 = trail[i]! * Math.PI * 2 - Math.PI / 2
      const tr = R * 0.86
      const alpha = Math.pow(i / trail.length, 2) * 0.5
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a1) * tr, cy + Math.sin(a1) * tr)
      ctx.lineTo(cx + Math.cos(a2) * tr, cy + Math.sin(a2) * tr)
      ctx.strokeStyle = `rgba(${rgb},${alpha.toFixed(2)})`
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  const arcEnd = -Math.PI / 2 + pos * Math.PI * 2
  ctx.beginPath()
  ctx.arc(cx, cy, R * 0.7, -Math.PI / 2, arcEnd)
  ctx.strokeStyle = `rgba(${rgb},.5)`
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.lineCap = 'butt'

  if (!isNaN(meanPhase)) {
    const rl = rBar * R * 0.72
    const ex = cx + Math.cos(meanPhase) * rl
    const ey = cy + Math.sin(meanPhase) * rl
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.strokeStyle = rCol
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - 9 * Math.cos(meanPhase - 0.4), ey - 9 * Math.sin(meanPhase - 0.4))
    ctx.lineTo(ex - 9 * Math.cos(meanPhase + 0.4), ey - 9 * Math.sin(meanPhase + 0.4))
    ctx.closePath()
    ctx.fillStyle = rCol
    ctx.fill()
  }

  const handA = pos * Math.PI * 2 - Math.PI / 2
  const hx = cx + Math.cos(handA) * R * 0.86
  const hy = cy + Math.sin(handA) * R * 0.86
  ctx.shadowColor = rCol
  ctx.shadowBlur = 14
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(hx, hy)
  ctx.strokeStyle = rCol
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.beginPath()
  ctx.arc(hx, hy, 5, 0, Math.PI * 2)
  ctx.fillStyle = rCol
  ctx.shadowColor = rCol
  ctx.shadowBlur = 18
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.font = '700 7px "Google Sans Code", monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = C.labelText
  ctx.fillText('PEAK', cx, cy - R * 0.52 + 3)
  ctx.fillText('TROUGH', cx, cy + R * 0.52 + 4)
  ctx.fillText('RISING', cx + R * 0.52, cy + 3)
  ctx.fillText('FALLING', cx - R * 0.52, cy + 3)

  if (hmmAlpha) {
    const stateA = [0, Math.PI / 2, Math.PI, Math.PI * 1.5]
    const stateC = [C.rising, C.peak, C.falling, C.trough]
    stateA.forEach((a, i) => {
      const mx2 = cx + Math.cos(a - Math.PI / 2) * R * 0.97
      const my2 = cy + Math.sin(a - Math.PI / 2) * R * 0.97
      ctx.beginPath()
      ctx.arc(mx2, my2, 3, 0, Math.PI * 2)
      ctx.fillStyle = stateC[i]!
      ctx.globalAlpha = 0.5 + 0.5 * hmmAlpha[i]!
      ctx.fill()
      ctx.globalAlpha = 1
    })
  }

  ctx.beginPath()
  ctx.arc(cx, cy, 5, 0, Math.PI * 2)
  ctx.fillStyle = C.centre
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, 2, 0, Math.PI * 2)
  ctx.fillStyle = rCol
  ctx.fill()
}
