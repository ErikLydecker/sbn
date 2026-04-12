import { useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VoxelDensityChart, type VoxelDensityChartHandle } from '@/components/charts/voxel-density-chart'
import { VoxelStructurePanel } from '@/components/panels/voxel-structure-panel'
import { useAnalysisStore } from '@/stores/analysis.store'
import {
  Box,
  Square,
  PanelLeft,
  PanelRight,
  ArrowUpFromDot,
  ArrowDownToDot,
  Orbit,
  RotateCw,
  Navigation,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react'

const INITIAL_AZ = 0.6
const INITIAL_EL = 0.3

const CAMERA_PRESETS: { label: string; icon: LucideIcon; az: number; el: number }[] = [
  { label: 'Perspective', icon: Box, az: INITIAL_AZ, el: INITIAL_EL },
  { label: 'Front', icon: Square, az: 0, el: 0 },
  { label: 'Back', icon: Orbit, az: Math.PI, el: 0 },
  { label: 'Left', icon: PanelLeft, az: -Math.PI / 2, el: 0 },
  { label: 'Right', icon: PanelRight, az: Math.PI / 2, el: 0 },
  { label: 'Top', icon: ArrowUpFromDot, az: 0, el: Math.PI / 2 - 0.01 },
  { label: 'Bottom', icon: ArrowDownToDot, az: 0, el: -(Math.PI / 2 - 0.01) },
]

const iconBtnBase =
  'flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors'
const iconBtnMuted =
  `${iconBtnBase} text-[#62666d] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#d0d6e0]`
const iconBtnAccent =
  `${iconBtnBase} text-[#7170ff] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#828fff]`

export function VoxelPage() {
  const smooth = useAnalysisStore((s) => s.smooth)
  const pts = smooth?.embeddingVecs ?? []
  const chartRef = useRef<VoxelDensityChartHandle>(null)

  const handlePreset = useCallback((az: number, el: number) => {
    chartRef.current?.setView(az, el)
  }, [])

  const handleAutoRotate = useCallback(() => {
    chartRef.current?.setAutoRotate(true)
  }, [])

  const handleReset = useCallback(() => {
    chartRef.current?.reset()
  }, [])

  const handleDrone = useCallback(() => {
    chartRef.current?.setDrone(true)
  }, [])

  return (
    <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-[1fr_340px]">
      <Card className="flex flex-col overflow-hidden">
        <CardHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle>
              Voxel Density
              <span className="ml-2 text-[11px] font-normal text-[#62666d]">
                drag to rotate &middot; scroll to zoom
              </span>
            </CardTitle>
            <div className="flex items-center gap-0.5">
              {CAMERA_PRESETS.map((p) => {
                const Icon = p.icon
                return (
                  <button
                    key={p.label}
                    onClick={() => handlePreset(p.az, p.el)}
                    className={iconBtnMuted}
                    title={p.label}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                )
              })}
              <div className="mx-1 h-4 w-px bg-[rgba(255,255,255,0.06)]" />
              <button onClick={handleAutoRotate} className={iconBtnAccent} title="Auto rotate">
                <RotateCw className="h-3.5 w-3.5" />
              </button>
              <button onClick={handleDrone} className={iconBtnAccent} title="Drone exploration">
                <Navigation className="h-3.5 w-3.5" />
              </button>
              <button onClick={handleReset} className={iconBtnAccent} title="Reset">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1">
          <VoxelDensityChart ref={chartRef} pts={pts} fillContainer />
        </CardContent>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        <CardHeader className="shrink-0">
          <CardTitle>
            Structure Analysis
            <span className="ml-2 text-[11px] font-normal text-[#62666d]">
              hidden geometry
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          <VoxelStructurePanel pts={pts} />
        </CardContent>
      </Card>
    </div>
  )
}
