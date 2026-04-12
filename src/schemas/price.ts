import { z } from 'zod/v4'

export const PriceTickSchema = z.object({
  price: z.number().positive(),
  timestamp: z.number(),
})

export type PriceTick = z.infer<typeof PriceTickSchema>

export const ConnectionSourceSchema = z.enum(['ws_primary', 'ws_fallback'])
export type ConnectionSource = z.infer<typeof ConnectionSourceSchema>

export const ConnectionStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('idle') }),
  z.object({ status: z.literal('connecting'), source: ConnectionSourceSchema }),
  z.object({ status: z.literal('live'), source: ConnectionSourceSchema }),
  z.object({ status: z.literal('reconnecting'), source: ConnectionSourceSchema }),
  z.object({ status: z.literal('waiting_retry'), nextRetryMs: z.number(), attempt: z.number() }),
  z.object({ status: z.literal('paused'), reason: z.literal('offline') }),
])

export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>

export interface ConnectionHealth {
  connectedSince: number | null
  uptimeMs: number
  totalReconnects: number
  lastMessageAt: number | null
  messagesReceived: number
  currentSource: ConnectionSource | null
  consecutiveFailures: number
}
