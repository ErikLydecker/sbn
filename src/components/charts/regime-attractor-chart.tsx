import { useRef, useEffect, useCallback, memo } from 'react'
import { REGIME_DEFINITIONS } from '@/schemas/regime'
import { CANVAS_COLORS as C } from '@/config/theme'
import type { PhaseKappaEntry } from '@/stores/geometry.store'

interface RegimeAttractorChartProps {
  pts: number[][]
  history: PhaseKappaEntry[]
}

const HEIGHT = 280
const AUTO_SPEED = 0.003

export const RegimeAttractorChart = memo(function RegimeAttractorChart({ pts, history }: RegimeAttractorChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const azRef = useRef(0.6)
  const elRef = useRef(0.3)
  const dragRef = useRef<{ startX: number; startY: number; startAz: number; startEl: number } | null>(null)
  const rafRef = useRef(0)
  const ptsRef = useRef(pts)
  const histRef = useRef(history)
  ptsRef.current = pts
  histRef.current = history

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCanvas(canvas, HEIGHT)
    if (!ctx) return
    const w = canvas.getBoundingClientRect().width
    drawRegimeAttractor(ctx, w, HEIGHT, ptsRef.current, histRef.current, azRef.current, elRef.current)
  }, [])

  useEffect(() => {
    let running = true
    const tick = () => {
      if (!running) return
      if (!dragRef.current) azRef.current += AUTO_SPEED
      draw()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { running = false; cancelAnimationFrame(rafRef.current) }
  }, [draw])

  useEffect(() => { draw() }, [pts, history, draw])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    canvasRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startAz: azRef.current, startEl: elRef.current }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    azRef.current = dragRef.current.startAz + (e.clientX - dragRef.current.startX) * 0.008
    elRef.current = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, dragRef.current.startEl + (e.clientY - dragRef.current.startY) * 0.008))
  }, [])

  const onPointerUp = useCallback(() => { dragRef.current = null }, [])

  return (
    <canvas
      ref={canvasRef}
      height={HEIGHT}
      className="w-full cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  )
})

function drawRegimeAttractor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pts: number[][],
  history: PhaseKappaEntry[],
  az: number,
  el: number,
): void {
  ctx.clearRect(0, 0, w, h)

  if (pts.length < 4) {
    ctx.fillStyle = C.mutedText
    ctx.font = '11px "Google Sans Code", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Awaiting embedding data\u2026', w / 2, h / 2)
    return
  }

  const cx = w / 2
  const cy = h / 2
  const margin = 30
  const scale = (Math.min(w, h) - margin * 2) / 2

  const projected = pts.map((p) => project3d(p as [number, number, number], az, el))

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of projected) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const fitScale = scale / Math.max(rangeX, rangeY) * 2
  const offX = (minX + maxX) / 2
  const offY = (minY + maxY) / 2

  const toScreen = (p: [number, number]): [number, number] => [
    cx + (p[0] - offX) * fitScale,
    cy + (p[1] - offY) * fitScale,
  ]

  const screen = projected.map((p) => toScreen(p))
  const n = screen.length

  const histOffset = Math.max(0, history.length - n)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let i = 1; i < n; i++) {
    const histIdx = histOffset + i
    const regimeId = histIdx < history.length ? history[histIdx]!.regimeId : 0
    const def = REGIME_DEFINITIONS[regimeId] ?? REGIME_DEFINITIONS[0]!
    const rgb = parseHex(def.color)
    const t = i / (n - 1)
    const alpha = 0.15 + 0.65 * t

    const [x0, y0] = screen[i - 1]!
    const [x1, y1] = screen[i]!
    const mx2 = (x0 + x1) / 2
    const my2 = (y0 + y1) / 2

    ctx.beginPath()
    if (i === 1) {
      ctx.moveTo(x0, y0)
      ctx.lineTo(mx2, my2)
    } else {
      const [px, py] = screen[i - 2]!
      const pmx = (px + x0) / 2
      const pmy = (py + y0) / 2
      ctx.moveTo(pmx, pmy)
      ctx.quadraticCurveTo(x0, y0, mx2, my2)
    }

    ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(2)})`
    ctx.lineWidth = 0.8 + t * 1.2
    ctx.stroke()
  }

  if (n > 0) {
    const [lx, ly] = screen[n - 1]!
    const lastRegime = history.length > 0 ? history[history.length - 1]!.regimeId : 0
    const lastColor = (REGIME_DEFINITIONS[lastRegime] ?? REGIME_DEFINITIONS[0]!).color
    ctx.beginPath()
    ctx.arc(lx, ly, 4, 0, Math.PI * 2)
    ctx.fillStyle = lastColor
    ctx.shadowColor = lastColor
    ctx.shadowBlur = 14
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

function project3d(p: [number, number, number], az: number, el: number): [number, number] {
  const ca = Math.cos(az), sa = Math.sin(az)
  const ce = Math.cos(el), se = Math.sin(el)
  return [ca * p[0] + sa * p[2], se * (sa * p[0] - ca * p[2]) + ce * p[1]]
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

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
