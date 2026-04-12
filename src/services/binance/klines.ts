import type { OhlcBar } from '@/services/ohlc/aggregator'
import type { Timeframe } from '@/schemas/settings'

const TF_BINANCE: Record<Timeframe, string> = {
  '1s': '1s',
  '1m': '1m',
  '5m': '5m',
}

export async function fetchHistoricalKlines(
  symbol: string,
  timeframe: Timeframe,
  limit: number,
): Promise<OhlcBar[]> {
  const interval = TF_BINANCE[timeframe]
  const url = `/api-binance/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Klines fetch failed: ${res.status}`)

  const raw: unknown[][] = await res.json()

  return raw.map((k) => ({
    time: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    ticks: 0,
  }))
}
