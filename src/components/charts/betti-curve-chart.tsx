import { useRef, useEffect, memo } from 'react'

interface BettiCurveChartProps {
  h0: number[]
  h1: number[]
  thresholds: number[]
  h1Peak: number
}

const HEIGHT = 240
const PAD = { top: 20, right: 60, bottom: 30, left: 50 }

export const BettiCurveChart = memo(function BettiCurveChart({
  h0,
  h1,
  thresholds,
  h1Peak,
}: BettiCurveChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || h0.length < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = HEIGHT * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = HEIGHT
    const plotW = w - PAD.left - PAD.right
    const plotH = h - PAD.top - PAD.bottom
    const n = h0.length

    ctx.clearRect(0, 0, w, h)

    const maxH0 = Math.max(...h0, 1)
    const maxH1 = Math.max(...h1, 1)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * plotH
      ctx.beginPath()
      ctx.moveTo(PAD.left, y)
      ctx.lineTo(PAD.left + plotW, y)
      ctx.stroke()
    }

    // H0 line (left y-axis)
    ctx.strokeStyle = '#50dd80'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = PAD.left + (i / (n - 1)) * plotW
      const y = PAD.top + plotH - (h0[i]! / maxH0) * plotH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // H1 line (right y-axis)
    ctx.strokeStyle = '#ff6b6b'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = PAD.left + (i / (n - 1)) * plotW
      const y = PAD.top + plotH - (h1[i]! / maxH1) * plotH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Fill under H1
    ctx.lineTo(PAD.left + plotW, PAD.top + plotH)
    ctx.lineTo(PAD.left, PAD.top + plotH)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 107, 107, 0.06)'
    ctx.fill()

    // Labels
    ctx.fillStyle = '#62666d'
    ctx.font = '10px "SF Mono", "Fira Code", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Distance threshold ε', PAD.left + plotW / 2, h - 4)

    // Left y-axis (H0)
    ctx.fillStyle = '#50dd80'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const val = maxH0 * (1 - i / 4)
      ctx.fillText(Math.round(val).toString(), PAD.left - 6, PAD.top + (i / 4) * plotH + 3)
    }

    // Right y-axis (H1)
    ctx.fillStyle = '#ff6b6b'
    ctx.textAlign = 'left'
    for (let i = 0; i <= 4; i++) {
      const val = maxH1 * (1 - i / 4)
      ctx.fillText(Math.round(val).toString(), PAD.left + plotW + 6, PAD.top + (i / 4) * plotH + 3)
    }

    // Legend + H1 peak badge
    ctx.font = '10px "SF Mono", "Fira Code", monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#50dd80'
    ctx.fillText('● H0 (components)', PAD.left, PAD.top - 6)
    ctx.fillStyle = '#ff6b6b'
    ctx.fillText(`● H1 (loops) peak=${Math.round(h1Peak)}`, PAD.left + 130, PAD.top - 6)
  }, [h0, h1, thresholds, h1Peak])

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: HEIGHT }}
    />
  )
})
