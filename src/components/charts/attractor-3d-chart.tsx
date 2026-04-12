import { useRef, useEffect, useCallback, memo } from 'react'
import { drawAttractor3d } from '@/core/dsp/draw-attractor-3d'

interface Attractor3dChartProps {
  pts: number[][]
}

const HEIGHT = 280
const AUTO_SPEED = 0.003

export const Attractor3dChart = memo(function Attractor3dChart({ pts }: Attractor3dChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const azRef = useRef(0.6)
  const elRef = useRef(0.3)
  const dragRef = useRef<{ startX: number; startY: number; startAz: number; startEl: number } | null>(null)
  const rafRef = useRef(0)
  const ptsRef = useRef(pts)
  ptsRef.current = pts

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCanvas(canvas, HEIGHT)
    if (!ctx) return
    const w = canvas.getBoundingClientRect().width
    drawAttractor3d(ctx, w, HEIGHT, ptsRef.current, azRef.current, elRef.current)
  }, [])

  useEffect(() => {
    let running = true

    const tick = () => {
      if (!running) return
      if (!dragRef.current) {
        azRef.current += AUTO_SPEED
      }
      draw()
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  useEffect(() => { draw() }, [pts, draw])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startAz: azRef.current,
      startEl: elRef.current,
    }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    azRef.current = dragRef.current.startAz + dx * 0.008
    elRef.current = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, dragRef.current.startEl + dy * 0.008))
  }, [])

  const onPointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        height={HEIGHT}
        className="w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
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
