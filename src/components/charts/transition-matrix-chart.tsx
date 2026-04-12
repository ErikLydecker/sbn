import { useRef, useEffect, memo } from 'react'
import { drawTransitions } from '@/core/dsp/draw-transitions'

interface TransitionMatrixChartProps {
  matrix: number[]
}

const HEIGHT = 260

export const TransitionMatrixChart = memo(function TransitionMatrixChart({ matrix }: TransitionMatrixChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCanvas(canvas, HEIGHT)
    if (!ctx) return
    const w = canvas.getBoundingClientRect().width
    drawTransitions(ctx, w, HEIGHT, matrix)
  }, [matrix])

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
