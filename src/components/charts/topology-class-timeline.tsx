import { useRef, useEffect, memo } from 'react'
import type { CoherencePoint } from '@/services/persistence/db'

const CLASS_COLORS: Record<string, string> = {
  stable_loop: '#50dd80',
  unstable_loop: '#ffaa33',
  drift: '#8a8f98',
  chaotic: '#ff5050',
}

interface TopologyClassTimelineProps {
  points: CoherencePoint[]
}

export const TopologyClassTimeline = memo(function TopologyClassTimeline({
  points,
}: TopologyClassTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height

    ctx.clearRect(0, 0, w, h)

    const withClass = points.filter((p) => p.topologyClass)
    if (withClass.length === 0) {
      ctx.fillStyle = '#62666d'
      ctx.font = '10px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('No topology data yet', w / 2, h / 2 + 4)
      return
    }

    const barWidth = Math.max(1, w / withClass.length)
    for (let i = 0; i < withClass.length; i++) {
      const cls = withClass[i]!.topologyClass ?? 'drift'
      ctx.fillStyle = CLASS_COLORS[cls] ?? '#8a8f98'
      ctx.fillRect(i * barWidth, 0, barWidth + 0.5, h)
    }
  }, [points])

  const latest = points.length > 0 ? points[points.length - 1]?.topologyClass : undefined

  return (
    <div>
      <div className="mb-2 flex items-center gap-3 text-[10px] font-[510] text-[#62666d]">
        <span>CLASS TIMELINE</span>
        {latest && (
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px] font-[590]"
            style={{ backgroundColor: `${CLASS_COLORS[latest] ?? '#8a8f98'}33`, color: CLASS_COLORS[latest] ?? '#8a8f98' }}
          >
            {latest.replace('_', ' ')}
          </span>
        )}
        <span className="ml-auto flex gap-2">
          {Object.entries(CLASS_COLORS).map(([cls, color]) => (
            <span key={cls} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span>{cls.replace('_', ' ')}</span>
            </span>
          ))}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg"
        style={{ height: 32 }}
      />
    </div>
  )
})
