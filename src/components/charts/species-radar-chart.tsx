import { useRef, useEffect, memo } from 'react'

interface SpeciesRadarChartProps {
  current: number[]
  labels?: string[]
}

const SIZE = 240
const PAD = 40

export const SpeciesRadarChart = memo(function SpeciesRadarChart({
  current,
  labels,
}: SpeciesRadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || current.length < 3) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = SIZE * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = SIZE
    const cx = w / 2
    const cy = h / 2
    const radius = Math.min(cx, cy) - PAD

    ctx.clearRect(0, 0, w, h)

    const n = current.length
    const angleStep = (2 * Math.PI) / n

    // Concentric rings
    for (let r = 1; r <= 4; r++) {
      const ringR = (r / 4) * radius
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Axis spokes
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + i * angleStep
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
      ctx.stroke()
    }

    // Current shape - filled polygon
    const maxVal = Math.max(...current, 1e-12)
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + i * angleStep
      const r = (current[i]! / maxVal) * radius
      const x = cx + r * Math.cos(angle)
      const y = cy + r * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(113, 112, 255, 0.15)'
    ctx.fill()
    ctx.strokeStyle = '#7170ff'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Dots at vertices
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + i * angleStep
      const r = (current[i]! / maxVal) * radius
      const x = cx + r * Math.cos(angle)
      const y = cy + r * Math.sin(angle)
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = '#7170ff'
      ctx.fill()
    }

    // Labels
    ctx.fillStyle = '#62666d'
    ctx.font = '9px "SF Mono", "Fira Code", monospace'
    ctx.textAlign = 'center'
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + i * angleStep
      const labelR = radius + 16
      const x = cx + labelR * Math.cos(angle)
      const y = cy + labelR * Math.sin(angle) + 3
      const label = labels?.[i] ?? `H${i + 1}`
      ctx.fillText(label, x, y)
    }
  }, [current, labels])

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: SIZE }}
    />
  )
})
