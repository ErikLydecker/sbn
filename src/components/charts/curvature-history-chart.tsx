import { useRef, useEffect, memo } from 'react'
import type { CurvatureHistoryPoint, TorsionHistoryPoint, SpeciesHistoryPoint } from '@/stores/morphology.store'

interface CurvatureHistoryChartProps {
  curvatureHistory: CurvatureHistoryPoint[]
  torsionHistory: TorsionHistoryPoint[]
  speciesHistory: SpeciesHistoryPoint[]
}

const HEIGHT = 260
const PAD = { top: 20, right: 60, bottom: 30, left: 50 }

const SPECIES_COLORS = [
  '#7170ff', '#50dd80', '#ff6b6b', '#ffaa33', '#66d9ef', '#ff79c6',
  '#a3be8c', '#d08770', '#b48ead', '#88c0d0',
]

export const CurvatureHistoryChart = memo(function CurvatureHistoryChart({
  curvatureHistory,
  torsionHistory,
  speciesHistory,
}: CurvatureHistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || curvatureHistory.length < 2) return
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
    const n = curvatureHistory.length

    ctx.clearRect(0, 0, w, h)

    const tMin = curvatureHistory[0]!.t
    const tMax = curvatureHistory[n - 1]!.t
    const tRange = tMax - tMin || 1

    // Max curvature and torsion for scaling
    let maxCurv = 0, maxTors = 0
    for (const p of curvatureHistory) {
      if (p.mean > maxCurv) maxCurv = p.mean
    }
    for (const p of torsionHistory) {
      if (p.energy > maxTors) maxTors = p.energy
    }
    maxCurv = maxCurv || 1
    maxTors = maxTors || 1

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

    // Species-colored background markers
    for (let i = 0; i < speciesHistory.length; i++) {
      const sp = speciesHistory[i]!
      const x = PAD.left + ((sp.t - tMin) / tRange) * plotW
      const color = SPECIES_COLORS[sp.species % SPECIES_COLORS.length]!
      ctx.fillStyle = color.replace(')', ', 0.12)').replace('rgb', 'rgba').replace('#', '')
      // Use hex to rgba
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.08)`
      ctx.fillRect(x - 1, PAD.top, 3, plotH)
    }

    // Mean curvature line (left y-axis)
    ctx.strokeStyle = '#7170ff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const p = curvatureHistory[i]!
      const x = PAD.left + ((p.t - tMin) / tRange) * plotW
      const y = PAD.top + plotH - (p.mean / maxCurv) * plotH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Torsion energy line (right y-axis)
    if (torsionHistory.length >= 2) {
      ctx.strokeStyle = '#ffaa33'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      for (let i = 0; i < torsionHistory.length; i++) {
        const p = torsionHistory[i]!
        const x = PAD.left + ((p.t - tMin) / tRange) * plotW
        const y = PAD.top + plotH - (p.energy / maxTors) * plotH
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Species dot markers on the curvature line
    for (let i = 0; i < Math.min(speciesHistory.length, n); i++) {
      const sp = speciesHistory[i]!
      const cp = curvatureHistory[i]
      if (!cp) continue
      const x = PAD.left + ((cp.t - tMin) / tRange) * plotW
      const y = PAD.top + plotH - (cp.mean / maxCurv) * plotH
      const color = SPECIES_COLORS[sp.species % SPECIES_COLORS.length]!
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }

    // Axis labels
    ctx.fillStyle = '#7170ff'
    ctx.font = '10px "SF Mono", "Fira Code", monospace'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const val = maxCurv * (1 - i / 4)
      ctx.fillText(val.toFixed(3), PAD.left - 6, PAD.top + (i / 4) * plotH + 3)
    }

    ctx.fillStyle = '#ffaa33'
    ctx.textAlign = 'left'
    for (let i = 0; i <= 4; i++) {
      const val = maxTors * (1 - i / 4)
      ctx.fillText(val.toFixed(2), PAD.left + plotW + 6, PAD.top + (i / 4) * plotH + 3)
    }

    // Legend
    ctx.font = '10px "SF Mono", "Fira Code", monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#7170ff'
    ctx.fillText('● Mean κ', PAD.left, PAD.top - 6)
    ctx.fillStyle = '#ffaa33'
    ctx.fillText('⋯ τ energy', PAD.left + 80, PAD.top - 6)
  }, [curvatureHistory, torsionHistory, speciesHistory])

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: HEIGHT }}
    />
  )
})
