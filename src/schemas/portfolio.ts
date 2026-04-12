import { z } from 'zod/v4'
import { OpenPositionSchema, ClosedTradeSchema } from './trade'
import { RegimeIdSchema } from './regime'

export const GpStateSchema = z.object({
  inputs: z.array(z.array(z.number())),
  outputs: z.array(z.number()),
  kernelInverse: z.array(z.array(z.number())).nullable(),
})

export type GpState = z.infer<typeof GpStateSchema>

export const PortfolioSnapshotSchema = z.object({
  equity: z.number(),
  initialEquity: z.number().positive(),
  position: OpenPositionSchema.nullable(),
  trades: z.array(ClosedTradeSchema),
  equityCurve: z.array(z.number()),
  currentRegimeId: RegimeIdSchema.nullable(),
  reentryCooldowns: z.array(z.number().int().nonnegative()),
  returns: z.array(z.number()),
  barCount: z.number().int().nonnegative(),
})

export type PortfolioSnapshot = z.infer<typeof PortfolioSnapshotSchema>
