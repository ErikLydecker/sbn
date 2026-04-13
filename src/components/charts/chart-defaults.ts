import {
  ColorType,
  type DeepPartial,
  type ChartOptions,
} from 'lightweight-charts'

type NestedPartial = DeepPartial<ChartOptions>

function deepMerge(base: NestedPartial, override: NestedPartial): NestedPartial {
  const result: Record<string, unknown> = { ...base }
  for (const key of Object.keys(override)) {
    const bVal = (base as Record<string, unknown>)[key]
    const oVal = (override as Record<string, unknown>)[key]
    if (
      bVal && oVal &&
      typeof bVal === 'object' && !Array.isArray(bVal) &&
      typeof oVal === 'object' && !Array.isArray(oVal)
    ) {
      result[key] = deepMerge(
        bVal as NestedPartial,
        oVal as NestedPartial,
      )
    } else {
      result[key] = oVal
    }
  }
  return result as NestedPartial
}

export const BASE_CHART_OPTIONS: DeepPartial<ChartOptions> = {
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: '#62666d',
    fontSize: 10,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: 'rgba(255,255,255,0.03)' },
    horzLines: { color: 'rgba(255,255,255,0.03)' },
  },
  crosshair: {
    vertLine: { color: 'rgba(113,112,255,0.3)', labelBackgroundColor: '#7170ff' },
    horzLine: { color: 'rgba(113,112,255,0.3)', labelBackgroundColor: '#7170ff' },
  },
  rightPriceScale: {
    borderColor: 'rgba(255,255,255,0.06)',
  },
  timeScale: {
    borderColor: 'rgba(255,255,255,0.06)',
  },
  handleScroll: { vertTouchDrag: false },
}

export function chartOptions(
  overrides: DeepPartial<ChartOptions> = {},
): DeepPartial<ChartOptions> {
  return deepMerge(BASE_CHART_OPTIONS, overrides)
}
