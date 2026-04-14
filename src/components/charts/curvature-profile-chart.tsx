import { useRef, useEffect, memo } from 'react'

interface CurvatureProfileChartProps {
  profile: number[]
  concentration: number
}

const HEIGHT = 240
const PAD = { top: 20, right: 10, bottom: 30, left: 50 }

export const CurvatureProfileChart = memo(function CurvatureProfileChart({
  profile,
  concentration,
}: CurvatureProfileChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || profile.length < 2) return
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

    ctx.clearRect(0, 0, w, h)

    const maxVal = Math.max(...profile, 1e-12)
    const n = profile.length

    // Concentration zone highlight (top quartile)
    const sorted = [...profile].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v)
    const topCount = Math.max(1, Math.floor(n / 4))
    const topIndices = new Set(sorted.slice(0, topCount).map((p) => p.i))

    ctx.fillStyle = 'rgba(255, 170, 51, 0.08)'
    for (let i = 0; i < n; i++) {
      if (topIndices.has(i)) {
        const x = PAD.left + (i / (n - 1)) * plotW
        ctx.fillRect(x - plotW / n / 2, PAD.top, plotW / n, plotH)
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * plotH
      ctx.beginPath()
      ctx.moveTo(PAD.left, y)
      ctx.lineTo(PAD.left + plotW, y)
      ctx.stroke()
    }

    // Curvature line
    ctx.strokeStyle = '#7170ff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = PAD.left + (i / (n - 1)) * plotW
      const y = PAD.top + plotH - (profile[i]! / maxVal) * plotH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Fill under
    ctx.lineTo(PAD.left + plotW, PAD.top + plotH)
    ctx.lineTo(PAD.left, PAD.top + plotH)
    ctx.closePath()
    ctx.fillStyle = 'rgba(113, 112, 255, 0.08)'
    ctx.fill()

    // Axis labels
    ctx.fillStyle = '#62666d'
    ctx.font = '10px "SF Mono", "Fira Code", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Arc-length (normalized)', PAD.left + plotW / 2, h - 4)

    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const val = maxVal * (1 - i / 4)
      const y = PAD.top + (i / 4) * plotH + 3
      ctx.fillText(val.toFixed(3), PAD.left - 6, y)
    }

    // Concentration badge
    ctx.fillStyle = 'rgba(255, 170, 51, 0.9)'
    ctx.font = '10px "SF Mono", "Fira Code", monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`conc: ${(concentration * 100).toFixed(1)}%`, w - PAD.right, PAD.top - 4)
  }, [profile, concentration])

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: HEIGHT }}
    />
  )
})
