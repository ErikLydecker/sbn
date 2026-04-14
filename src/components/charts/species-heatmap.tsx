import { useRef, useEffect, memo } from 'react'
import type { SpeciesCatalogEntry } from '@/stores/morphology.store'

interface SpeciesHeatmapProps {
  catalog: SpeciesCatalogEntry[]
  currentSpecies: number
}

const REGIME_LABELS = ['R0·Hi', 'R0·Lo', 'P1·Hi', 'P1·Lo', 'F2·Hi', 'F2·Lo', 'T3·Hi', 'T3·Lo']
const CELL_W = 56
const CELL_H = 28
const PAD = { top: 24, left: 40, bottom: 4, right: 4 }

export const SpeciesHeatmap = memo(function SpeciesHeatmap({
  catalog,
  currentSpecies,
}: SpeciesHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sorted = [...catalog].sort((a, b) => a.id - b.id)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const nRows = Math.max(sorted.length, 1)
    const nCols = 8
    const w = PAD.left + nCols * CELL_W + PAD.right
    const h = PAD.top + nRows * CELL_H + PAD.bottom

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    // Column headers
    ctx.fillStyle = '#62666d'
    ctx.font = '9px "SF Mono", "Fira Code", monospace'
    ctx.textAlign = 'center'
    for (let c = 0; c < nCols; c++) {
      ctx.fillText(REGIME_LABELS[c]!, PAD.left + c * CELL_W + CELL_W / 2, PAD.top - 8)
    }

    if (sorted.length === 0) {
      ctx.fillStyle = '#62666d'
      ctx.textAlign = 'center'
      ctx.fillText('Awaiting species data...', w / 2, PAD.top + 20)
      return
    }

    // Find global max absolute return for color scaling
    let maxAbs = 0.01
    for (const entry of sorted) {
      for (const rr of Object.values(entry.regimeReturns)) {
        const avg = rr.count > 0 ? rr.sum / rr.count : 0
        if (Math.abs(avg) > maxAbs) maxAbs = Math.abs(avg)
      }
    }

    for (let r = 0; r < sorted.length; r++) {
      const entry = sorted[r]!
      const y = PAD.top + r * CELL_H
      const isActive = entry.id === currentSpecies

      // Row label
      ctx.fillStyle = isActive ? '#7170ff' : '#8a8f98'
      ctx.font = '10px "SF Mono", "Fira Code", monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`S-${entry.id}`, PAD.left - 6, y + CELL_H / 2 + 3)

      for (let c = 0; c < nCols; c++) {
        const x = PAD.left + c * CELL_W
        const rr = entry.regimeReturns[c]
        const avg = rr && rr.count > 0 ? rr.sum / rr.count : 0
        const count = rr?.count ?? 0

        // Cell color: green for positive, red for negative, intensity by magnitude
        const intensity = Math.min(Math.abs(avg) / maxAbs, 1) * 0.5
        if (count > 0) {
          ctx.fillStyle = avg >= 0
            ? `rgba(80, 221, 128, ${intensity})`
            : `rgba(255, 107, 107, ${intensity})`
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.02)'
        }

        ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2)

        // Cell border
        ctx.strokeStyle = isActive ? 'rgba(113,112,255,0.2)' : 'rgba(255,255,255,0.04)'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, CELL_W - 1, CELL_H - 1)

        // Cell text
        if (count > 0) {
          ctx.fillStyle = avg >= 0 ? '#50dd80' : '#ff6b6b'
          ctx.font = '9px "SF Mono", "Fira Code", monospace'
          ctx.textAlign = 'center'
          ctx.fillText(`${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%`, x + CELL_W / 2, y + CELL_H / 2 + 3)
        }
      }
    }
  }, [sorted, currentSpecies])

  return (
    <div className="overflow-x-auto">
      <canvas ref={canvasRef} />
    </div>
  )
})
