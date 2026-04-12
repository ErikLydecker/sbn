import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { useSettingsStore } from '@/stores/settings.store'
import { DSP_CONFIG } from '@/config/dsp'
import { cn } from '@/lib/utils'

export function SettingsPage() {
  const rawWindow = useSettingsStore((s) => s.rawWindow)
  const setRawWindow = useSettingsStore((s) => s.setRawWindow)
  const themeMode = useSettingsStore((s) => s.themeMode)
  const setThemeMode = useSettingsStore((s) => s.setThemeMode)

  return (
    <div className="max-w-2xl space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>DSP Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-[13px] font-[510]">
              <span className="text-[#8a8f98]">Raw Window</span>
              <span className="font-mono text-[12px] text-accent">{rawWindow}</span>
            </div>
            <Slider
              min={DSP_CONFIG.raw.minWindow}
              max={DSP_CONFIG.raw.maxWindow}
              step={16}
              value={[rawWindow]}
              onValueChange={([v]) => { if (v !== undefined) setRawWindow(v) }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 text-[13px] font-[510] text-[#8a8f98]">Theme</div>
            <div className="flex gap-2">
              {(['dark', 'light', 'system'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setThemeMode(mode)}
                  className={cn(
                    'rounded-[6px] border px-3 py-1.5 text-[12px] font-[510] capitalize transition-colors',
                    themeMode === mode
                      ? 'border-accent bg-[rgba(113,112,255,0.08)] text-accent'
                      : 'border-[rgba(255,255,255,0.08)] text-[#8a8f98] hover:bg-[rgba(255,255,255,0.03)]',
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
