import { useAnalysisStore } from '@/stores/analysis.store'

export function useAnalysis() {
  const raw = useAnalysisStore((s) => s.raw)
  const smooth = useAnalysisStore((s) => s.smooth)
  const eventBarCount = useAnalysisStore((s) => s.eventBarCount)

  return { raw, smooth, eventBarCount }
}
