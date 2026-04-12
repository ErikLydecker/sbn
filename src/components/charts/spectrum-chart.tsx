import { useRef, useEffect, memo } from 'react'
import { drawSpectrum } from '@/core/dsp/draw-spectrum'
import type { FrequencyBin } from '@/schemas/analysis'

interface SpectrumChartProps {
  frequencies: FrequencyBin[]
  dominantK: number
}

export const SpectrumChart = memo(function SpectrumChart({
  frequencies,
  dominantK,
}: SpectrumChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !frequencies.length) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (rect.width < 2) return
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(90 * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    drawSpectrum(ctx, rect.width, 90, frequencies, dominantK)
  }, [frequencies, dominantK])

  return <canvas ref={canvasRef} height={90} className="w-full rounded-lg" />
})
