import { useRef, useEffect, memo, useCallback } from 'react'
import type { ClosedTrade } from '@/schemas/trade'

interface CoherenceScatterChartProps {
  trades: ClosedTrade[]
}

interface PlottableTrade {
  rBar: number
  returnPct: number
  reason: string
}

const REASON_COLORS: Record<string, string> = {
  stop: '#ff5050',
  regime_flip: '#ffaa33',
  phase_target: '#50dd80',
}

const AXIS_COLOR = 'rgba(255,255,255,0.08)'
const LABEL_COLOR = '#62666d'
const ZERO_LINE_COLOR = 'rgba(255,255,255,0.06)'
const TREND_COLOR = 'rgba(113,112,255,0.5)'

const PADDING = { top: 20, right: 20, bottom: 32, left: 52 }

function pearson(xs: number[], ys: number[]): { r: number; slope: number; intercept: number } {
  const n = xs.length
  if (n < 3) return { r: 0, slope: 0, intercept: 0 }

  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]!
    sy += ys[i]!
    sxx += xs[i]! * xs[i]!
    syy += ys[i]! * ys[i]!
    sxy += xs[i]! * ys[i]!
  }

  const denom = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy))
  const r = denom === 0 ? 0 : (n * sxy - sx * sy) / denom
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1)
  const intercept = (sy - slope * sx) / n

  return { r, slope, intercept }
}

export const CoherenceScatterChart = memo(function CoherenceScatterChart({
  trades,
}: CoherenceScatterChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const plottable: PlottableTrade[] = trades
    .filter((t): t is ClosedTrade & { entryRBar: number } => t.entryRBar != null)
    .map((t) => ({ rBar: t.entryRBar!, returnPct: t.returnPct, reason: t.reason }))

  const xs = plottable.map((t) => t.rBar)
  const ys = plottable.map((t) => t.returnPct)
  const stats = pearson(xs, ys)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth
    const h = 200
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const plotW = w - PADDING.left - PADDING.right
    const plotH = h - PADDING.top - PADDING.bottom

    if (plottable.length < 2) {
      ctx.fillStyle = LABEL_COLOR
      ctx.font = "11px 'SF Mono', 'Fira Code', monospace"
      ctx.textAlign = 'center'
      ctx.fillText('Waiting for trades with coherence data...', w / 2, h / 2)
      return
    }

    const xMin = 0
    const xMax = Math.max(0.5, ...xs) * 1.05
    const yAbsMax = Math.max(1, ...ys.map(Math.abs)) * 1.15
    const yMin = -yAbsMax
    const yMax = yAbsMax

    const toX = (v: number) => PADDING.left + ((v - xMin) / (xMax - xMin)) * plotW
    const toY = (v: number) => PADDING.top + ((yMax - v) / (yMax - yMin)) * plotH

    // axes
    ctx.strokeStyle = AXIS_COLOR
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PADDING.left, PADDING.top)
    ctx.lineTo(PADDING.left, PADDING.top + plotH)
    ctx.lineTo(PADDING.left + plotW, PADDING.top + plotH)
    ctx.stroke()

    // zero return line
    if (yMin < 0 && yMax > 0) {
      ctx.strokeStyle = ZERO_LINE_COLOR
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      const zy = toY(0)
      ctx.moveTo(PADDING.left, zy)
      ctx.lineTo(PADDING.left + plotW, zy)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // trend line
    if (plottable.length >= 3) {
      const tx0 = xMin
      const tx1 = xMax
      const ty0 = stats.slope * tx0 + stats.intercept
      const ty1 = stats.slope * tx1 + stats.intercept

      ctx.strokeStyle = TREND_COLOR
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(toX(tx0), toY(ty0))
      ctx.lineTo(toX(tx1), toY(ty1))
      ctx.stroke()
      ctx.setLineDash([])
    }

    // dots
    for (const t of plottable) {
      const cx = toX(t.rBar)
      const cy = toY(t.returnPct)
      ctx.beginPath()
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = REASON_COLORS[t.reason] ?? '#888'
      ctx.globalAlpha = 0.8
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // axis labels
    ctx.fillStyle = LABEL_COLOR
    ctx.font = "10px 'SF Mono', 'Fira Code', monospace"
    ctx.textAlign = 'center'

    const xTicks = 5
    for (let i = 0; i <= xTicks; i++) {
      const v = xMin + (i / xTicks) * (xMax - xMin)
      const px = toX(v)
      ctx.fillText(`${(v * 100).toFixed(0)}%`, px, h - 6)
    }

    ctx.textAlign = 'right'
    const yTicks = 4
    for (let i = 0; i <= yTicks; i++) {
      const v = yMin + (i / yTicks) * (yMax - yMin)
      const py = toY(v)
      ctx.fillText(`${v.toFixed(1)}%`, PADDING.left - 6, py + 3)
    }

    // axis titles
    ctx.fillStyle = '#4a4e56'
    ctx.font = "9px 'SF Mono', 'Fira Code', monospace"
    ctx.textAlign = 'center'
    ctx.fillText('R̄ at entry', PADDING.left + plotW / 2, h - 0)

    ctx.save()
    ctx.translate(10, PADDING.top + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Return %', 0, 0)
    ctx.restore()
  }, [plottable, xs, ys, stats])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(() => draw())
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [draw])

  const wins = plottable.filter((t) => t.returnPct > 0)
  const losses = plottable.filter((t) => t.returnPct <= 0)
  const avgRBarWins = wins.length > 0 ? wins.reduce((s, t) => s + t.rBar, 0) / wins.length : 0
  const avgRBarLosses = losses.length > 0 ? losses.reduce((s, t) => s + t.rBar, 0) / losses.length : 0

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-[10px] font-[510] text-[#62666d]">
        <span>
          TRADES{' '}
          <span className="text-[#8a8f98]">{plottable.length}</span>
          {trades.length > plottable.length && (
            <span className="ml-1 text-[#4a4e56]">({trades.length - plottable.length} pre-tracking)</span>
          )}
        </span>
        <span>
          PEARSON r{' '}
          <span className={stats.r > 0.15 ? 'text-[#50dd80]' : stats.r < -0.15 ? 'text-[#ff5050]' : 'text-[#8a8f98]'}>
            {plottable.length >= 3 ? stats.r.toFixed(3) : '—'}
          </span>
        </span>
        <span>
          AVG R̄ WINS{' '}
          <span className="text-[#50dd80]">{wins.length > 0 ? `${(avgRBarWins * 100).toFixed(1)}%` : '—'}</span>
        </span>
        <span>
          AVG R̄ LOSSES{' '}
          <span className="text-[#ff5050]">{losses.length > 0 ? `${(avgRBarLosses * 100).toFixed(1)}%` : '—'}</span>
        </span>
      </div>
      <div className="mb-2 flex gap-3 text-[10px] text-[#4a4e56]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#50dd80]" />
          phase target
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#ffaa33]" />
          regime flip
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#ff5050]" />
          stop
        </span>
      </div>
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
})
