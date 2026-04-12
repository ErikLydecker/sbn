import { usePriceStore } from '@/stores/price.store'

export function usePriceStream() {
  const candles = usePriceStore((s) => s.candles)
  const latestPrice = usePriceStore((s) => s.latestPrice)
  const openPrice = usePriceStore((s) => s.openPrice)

  const priceChange = openPrice > 0 ? ((latestPrice - openPrice) / openPrice) * 100 : 0

  return { candles, latestPrice, openPrice, priceChange }
}
