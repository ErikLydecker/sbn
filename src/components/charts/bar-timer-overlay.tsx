import { useBarCountdown, formatCountdown } from '@/hooks/use-bar-countdown'

export function BarTimerOverlay() {
  const { remainingMs, pct, overdue } = useBarCountdown()

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end">
      <div className="relative h-[2px] w-full bg-[rgba(255,255,255,0.04)]">
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear"
          style={{
            width: `${(pct * 100).toFixed(1)}%`,
            backgroundColor: overdue ? 'rgba(255,170,51,0.5)' : 'rgba(113,112,255,0.45)',
          }}
        />
      </div>
      <span
        className="absolute bottom-1 right-1 font-mono text-[9px] font-[510] tabular-nums"
        style={{ color: overdue ? '#ffaa33' : '#62666d' }}
      >
        {formatCountdown(remainingMs)}
      </span>
    </div>
  )
}
