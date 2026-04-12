import { memo } from 'react'

interface CoherenceBarProps {
  kappa: number
  rBar: number
  tDom?: number
  tDomFrac?: number
}

export const CoherenceBar = memo(function CoherenceBar({ kappa, rBar, tDom, tDomFrac }: CoherenceBarProps) {
  const pct = Math.min(rBar * 100, 100)
  const tLabel = tDomFrac !== undefined
    ? `T=${tDomFrac.toFixed(1)}b`
    : tDom !== undefined
      ? `T=${tDom}b`
      : undefined

  return (
    <div className="w-full max-w-xs">
      <div className="flex justify-between text-[10px] font-[510] text-[#62666d]">
        <span>
          VM COHERENCE κ={kappa.toFixed(1)}
          {tLabel && (
            <span className="ml-1 text-[#8a8f98]">{tLabel}</span>
          )}
        </span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="my-1.5 h-[3px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #62666d, #8a8f98, #7170ff)',
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-[400] text-[#62666d]">
        <span>chaos</span>
        <span>weak</span>
        <span>certain</span>
      </div>
    </div>
  )
})
