import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settings.store'
import { DSP_CONFIG } from '@/config/dsp'
import type { Timeframe } from '@/schemas/settings'

const TIMEFRAMES: Timeframe[] = ['1s', '1m', '5m']

export function DspControls() {
  const rawWindow = useSettingsStore((s) => s.rawWindow)
  const setRawWindow = useSettingsStore((s) => s.setRawWindow)
  const manualK = useSettingsStore((s) => s.manualFrequencyK)
  const setManualK = useSettingsStore((s) => s.setManualFrequencyK)
  const timeframe = useSettingsStore((s) => s.timeframe)
  const setTimeframe = useSettingsStore((s) => s.setTimeframe)

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div>
        <div className="mb-1.5 text-[10px] font-[510] uppercase tracking-[0.05em] text-[#62666d]">
          Timeframe
        </div>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <Button
              key={tf}
              variant={timeframe === tf ? 'brand' : 'ghost'}
              size="toolbar"
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-[510] uppercase tracking-[0.05em] text-[#62666d]">
            <span>Freq k</span>
            <span className="text-accent">{manualK !== null ? `k=${manualK}` : 'auto'}</span>
          </div>
          <Slider
            min={1}
            max={30}
            step={1}
            value={[manualK ?? 10]}
            onValueChange={([v]) => { if (v !== undefined) setManualK(v) }}
          />
        </div>
        <div className="flex-1">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-[510] uppercase tracking-[0.05em] text-[#62666d]">
            <span>Window</span>
            <span className="text-accent">{rawWindow}</span>
          </div>
          <Slider
            min={DSP_CONFIG.raw.minWindow}
            max={DSP_CONFIG.raw.maxWindow}
            step={16}
            value={[rawWindow]}
            onValueChange={([v]) => { if (v !== undefined) setRawWindow(v) }}
          />
        </div>
      </div>
    </div>
  )
}
