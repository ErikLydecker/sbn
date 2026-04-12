import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserSettings, ThemeMode, Timeframe } from '@/schemas/settings'
import { DEFAULT_SETTINGS } from '@/schemas/settings'

interface SettingsState extends UserSettings {
  setRawWindow: (win: number) => void
  setManualFrequencyK: (k: number | null) => void
  setTimeframe: (tf: Timeframe) => void
  setThemeMode: (mode: ThemeMode) => void
  setAccentColor: (color: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setRawWindow: (rawWindow) => set({ rawWindow }),
      setManualFrequencyK: (manualFrequencyK) => set({ manualFrequencyK }),
      setTimeframe: (timeframe) => set({ timeframe }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setAccentColor: (accentColor) => set({ accentColor }),
    }),
    { name: 'sbn-settings' },
  ),
)
