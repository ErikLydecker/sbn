import { useRef, useEffect, memo, useState, useCallback } from 'react'
import { drawClock } from '@/core/dsp/draw-clock'

interface PhaseClockProps {
  canvasId: string
  position: number
  rBar: number
  meanPhase: number
  trail?: number[]
  kappa?: number
  hmmAlpha?: readonly [number, number, number, number]
}

export const PhaseClock = memo(function PhaseClock({
  position,
  rBar,
  meanPhase,
  trail,
  kappa,
  hmmAlpha,
}: PhaseClockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(360)

  const measure = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    const s = Math.min(el.clientWidth, el.clientHeight)
    if (s > 10) setSize(s)
  }, [])

  useEffect(() => {
    measure()
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCanvas(canvas, size)
    if (!ctx) return
    drawClock(ctx, size, size, position, rBar, meanPhase, trail, kappa, hmmAlpha)
  }, [position, rBar, meanPhase, trail, kappa, hmmAlpha, size])

  return (
    <div ref={wrapperRef} className="flex w-full flex-1 items-center justify-center">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
      />
    </div>
  )
})

function setupCanvas(canvas: HTMLCanvasElement, size: number): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1
  if (size < 2) return null
  canvas.width = Math.round(size * dpr)
  canvas.height = Math.round(size * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(dpr, dpr)
  return ctx
}
