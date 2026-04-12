export const BINANCE_CONFIG = {
  ws: {
    primary: '/ws-binance/btcusdt@trade',
    fallback: '/ws-binance-alt/btcusdt@trade',
    connectTimeoutMs: 4_000,
    staleThresholdMs: 10_000,
    heartbeatIntervalMs: 5_000,
  },
  retry: {
    baseDelayMs: 1_000,
    maxDelayMs: 30_000,
    jitterMs: 500,
  },
  symbol: 'BTCUSDT',
  displayPair: 'BTC / USDT',
} as const
