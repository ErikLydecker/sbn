import { z } from 'zod/v4'
import { RegimeIdSchema } from './regime'

export const TradeDirectionSchema = z.union([z.literal(1), z.literal(-1)])
export type TradeDirection = z.infer<typeof TradeDirectionSchema>

export const ExitReasonSchema = z.enum(['stop', 'regime_flip', 'phase_target'])
export type ExitReason = z.infer<typeof ExitReasonSchema>

export const OpenPositionSchema = z.object({
  direction: TradeDirectionSchema,
  entryPrice: z.number().positive(),
  entryBar: z.number().int().nonnegative(),
  entryClockPos: z.number(),
  sizeUsd: z.number().positive(),
  stop: z.number().positive(),
  exitPhase: z.number(),
  regimeId: RegimeIdSchema,
  paramVector: z.array(z.number()),
  entryEquity: z.number().positive(),
  entryKappa: z.number().optional(),
  entryRBar: z.number().optional(),
  entryMorphologySpecies: z.number().int().optional(),
})

export type OpenPosition = z.infer<typeof OpenPositionSchema>

export const ClosedTradeSchema = z.object({
  regimeId: RegimeIdSchema,
  direction: TradeDirectionSchema,
  pnl: z.number(),
  returnPct: z.number(),
  reward: z.number(),
  bars: z.number().int().nonnegative(),
  reason: ExitReasonSchema,
  exitPrice: z.number().positive(),
  timestamp: z.number(),
  paramVector: z.array(z.number()),
  entryKappa: z.number().optional(),
  entryRBar: z.number().optional(),
  entryMorphologySpecies: z.number().int().optional(),
})

export type ClosedTrade = z.infer<typeof ClosedTradeSchema>
