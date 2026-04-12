import { z } from 'zod/v4'

export const RegimeIdSchema = z.number().int().min(0).max(7)
export type RegimeId = z.infer<typeof RegimeIdSchema>

export const RegimeDefinitionSchema = z.object({
  id: RegimeIdSchema,
  name: z.string(),
  phase: z.number().int().min(0).max(3),
  highCoherence: z.boolean(),
  icon: z.string(),
  color: z.string(),
})

export type RegimeDefinition = z.infer<typeof RegimeDefinitionSchema>

export const REGIME_DEFINITIONS: readonly RegimeDefinition[] = [
  { id: 0, name: 'RISING·HIGH', phase: 0, highCoherence: true, icon: '↗', color: '#7170ff' },
  { id: 1, name: 'RISING·LOW', phase: 0, highCoherence: false, icon: '↗', color: '#4e4daa' },
  { id: 2, name: 'PEAK·HIGH', phase: 1, highCoherence: true, icon: '▲', color: '#d0d6e0' },
  { id: 3, name: 'PEAK·LOW', phase: 1, highCoherence: false, icon: '▲', color: '#7a7e88' },
  { id: 4, name: 'FALLING·HIGH', phase: 2, highCoherence: true, icon: '↘', color: '#a0a4ac' },
  { id: 5, name: 'FALLING·LOW', phase: 2, highCoherence: false, icon: '↘', color: '#585c64' },
  { id: 6, name: 'TROUGH·HIGH', phase: 3, highCoherence: true, icon: '▼', color: '#6e7280' },
  { id: 7, name: 'TROUGH·LOW', phase: 3, highCoherence: false, icon: '▼', color: '#3a3e48' },
] as const
