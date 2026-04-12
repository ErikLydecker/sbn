import { useRef, useEffect, memo } from 'react'
import { drawAttractor2d } from '@/core/dsp/draw-attractor-2d'

interface Attractor2dChartProps {
  pts: number[][]
}

const HEIGHT = 280

export const Attractor2dChart = memo(function Attractor2dChart({ pts }: Attractor2dChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCanvas(canvas, HEIGHT)
    if (!ctx) return
    const w = canvas.getBoundingClientRect().width
    drawAttractor2d(ctx, w, HEIGHT, pts)
  }, [pts])

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
