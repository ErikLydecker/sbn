import { useRef, useEffect, memo } from 'react'
import { drawRecurrence } from '@/core/dsp/draw-recurrence'

interface RecurrenceChartProps {
  matrix: number[]
  size: number
}

const HEIGHT = 280

export const RecurrenceChart = memo(function RecurrenceChart({ matrix, size }: RecurrenceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCanvas(canvas, HEIGHT)
    if (!ctx) return
    const w = canvas.getBoundingClientRect().width
    drawRecurrence(ctx, w, HEIGHT, matrix, size)
  }, [matrix, size])

  return (
    <div className="w-full">
      <canvas ref={canvasRef} height={HEIGHT} className="w-full" />
    </div>
  )
})

function setupCanvas(canvas: HTMLCanvasElement, h: number): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  if (rect.width < 2) return null
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(dpr, dpr)
  return ctx
}
