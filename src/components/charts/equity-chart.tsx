import { useRef, useEffect, memo } from 'react'
import { drawEquityCurve } from '@/core/trading/draw-equity'
import { TRADING_CONFIG } from '@/config/trading'

interface EquityChartProps {
  curve: number[]
  initialEquity?: number
}

export const EquityChart = memo(function EquityChart({
  curve,
  initialEquity = TRADING_CONFIG.initialEquity,
}: EquityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || curve.length < 2) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (rect.width < 2) return
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(80 * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    drawEquityCurve(ctx, rect.width, 80, curve, initialEquity)
  }, [curve, initialEquity])

  return <canvas ref={canvasRef} height={80} className="w-full rounded-lg" />
})
