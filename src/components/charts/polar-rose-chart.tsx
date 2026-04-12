import { useRef, useEffect, memo } from 'react'
import { drawPolarRose } from '@/core/dsp/draw-polar-rose'

interface PolarRoseChartProps {
  pts: { phase: number; kappa: number }[]
  color: string
  maxKappa: number
}

const HEIGHT = 200

export const PolarRoseChart = memo(function PolarRoseChart({ pts, color, maxKappa }: PolarRoseChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCanvas(canvas, HEIGHT)
    if (!ctx) return
    const w = canvas.getBoundingClientRect().width
    drawPolarRose(ctx, w, HEIGHT, pts, color, maxKappa)
  }, [pts, color, maxKappa])

  return <canvas ref={canvasRef} height={HEIGHT} className="w-full" />
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
