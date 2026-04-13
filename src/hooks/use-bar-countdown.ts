import { useState, useEffect } from 'react'
import { useBarTimerStore } from '@/stores/bar-timer.store'

export interface BarCountdown {
  remainingMs: number
  pct: number
  intervalMs: number
  overdue: boolean
}

export function useBarCountdown(): BarCountdown {
  const lastBarTime = useBarTimerStore((s) => s.lastBarTime)
  const intervalMs = useBarTimerStore((s) => s.intervalMs)

  const tickRate = intervalMs <= 1_000 ? 200 : 1_000

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickRate)
    return () => clearInterval(id)
  }, [tickRate])

  if (lastBarTime <= 0) {
    return { remainingMs: 0, pct: 0, intervalMs, overdue: false }
  }

  const nextBarAt = lastBarTime + intervalMs
  const remainingMs = Math.max(0, nextBarAt - now)
  const pct = Math.min(1, 1 - remainingMs / intervalMs)
  const overdue = now >= nextBarAt

  return { remainingMs, pct, intervalMs, overdue }
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSec = Math.ceil(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}
