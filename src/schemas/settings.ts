import { z } from 'zod/v4'

export const ThemeModeSchema = z.enum(['dark', 'light', 'system'])
export type ThemeMode = z.infer<typeof ThemeModeSchema>

export const TimeframeSchema = z.enum(['1s', '1m', '5m'])
export type Timeframe = z.infer<typeof TimeframeSchema>

export const UserSettingsSchema = z.object({
  rawWindow: z.number().int().min(32).max(256),
  manualFrequencyK: z.number().int().positive().nullable(),
  timeframe: TimeframeSchema,
  themeMode: ThemeModeSchema,
  accentColor: z.string(),
})

export type UserSettings = z.infer<typeof UserSettingsSchema>

export const DEFAULT_SETTINGS: UserSettings = {
  rawWindow: 128,
  manualFrequencyK: null,
  timeframe: '1m',
  themeMode: 'dark',
  accentColor: '#7170ff',
}
