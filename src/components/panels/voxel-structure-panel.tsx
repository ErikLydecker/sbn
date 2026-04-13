import { memo, useMemo } from 'react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { computeShapeMetrics, type ShapeMetrics } from '@/core/dsp/shape-metrics'

interface VoxelStructurePanelProps {
  pts: number[][]
}

const GRID = 20

interface VoxelGridStats {
  occupancy: number
  totalVoxels: number
  occupied: number
  maxDensity: number
  meanDensity: number
  centroid: [number, number, number]
  spread: [number, number, number]
  gyrationRadius: number
}

interface VoxelMetrics {
  grid: VoxelGridStats
  shape: ShapeMetrics
  radialShellsDetailed: { r: number; count: number; fraction: number }[]
}

function computeGridStats(pts: number[][]): VoxelGridStats | null {
  if (pts.length < 4) return null

  const minV: [number, number, number] = [Infinity, Infinity, Infinity]
  const maxV: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const p of pts) {
    for (let d = 0; d < 3; d++) {
      if (p[d]! < minV[d]!) minV[d] = p[d]!
      if (p[d]! > maxV[d]!) maxV[d] = p[d]!
    }
  }
  const range: [number, number, number] = [
    maxV[0] - minV[0] || 1,
    maxV[1] - minV[1] || 1,
    maxV[2] - minV[2] || 1,
  ]

  const grid = new Float32Array(GRID * GRID * GRID)
  for (const p of pts) {
    const ix = Math.min(GRID - 1, Math.floor(((p[0]! - minV[0]!) / range[0]!) * GRID))
    const iy = Math.min(GRID - 1, Math.floor(((p[1]! - minV[1]!) / range[1]!) * GRID))
    const iz = Math.min(GRID - 1, Math.floor(((p[2]! - minV[2]!) / range[2]!) * GRID))
    const gi = ix * GRID * GRID + iy * GRID + iz
    grid[gi] = grid[gi]! + 1
  }

  let maxDensity = 0
  let occupied = 0
  let sumDensity = 0
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]! > 0) {
      occupied++
      sumDensity += grid[i]!
      if (grid[i]! > maxDensity) maxDensity = grid[i]!
    }
  }
  const totalVoxels = GRID * GRID * GRID
  const occupancy = occupied / totalVoxels
  const meanDensity = occupied > 0 ? sumDensity / occupied : 0

  const cx: [number, number, number] = [0, 0, 0]
  let totalW = 0
  for (let ix = 0; ix < GRID; ix++) {
    for (let iy = 0; iy < GRID; iy++) {
      for (let iz = 0; iz < GRID; iz++) {
        const d = grid[ix * GRID * GRID + iy * GRID + iz]!
        if (d < 1) continue
        cx[0] += d * (ix + 0.5) / GRID
        cx[1] += d * (iy + 0.5) / GRID
        cx[2] += d * (iz + 0.5) / GRID
        totalW += d
      }
    }
  }
  if (totalW > 0) { cx[0] /= totalW; cx[1] /= totalW; cx[2] /= totalW }
  const centroid: [number, number, number] = [cx[0], cx[1], cx[2]]

  const variance: [number, number, number] = [0, 0, 0]
  for (let ix = 0; ix < GRID; ix++) {
    for (let iy = 0; iy < GRID; iy++) {
      for (let iz = 0; iz < GRID; iz++) {
        const d = grid[ix * GRID * GRID + iy * GRID + iz]!
        if (d < 1) continue
        const px = (ix + 0.5) / GRID
        const py = (iy + 0.5) / GRID
        const pz = (iz + 0.5) / GRID
        variance[0] += d * (px - cx[0]) ** 2
        variance[1] += d * (py - cx[1]) ** 2
        variance[2] += d * (pz - cx[2]) ** 2
      }
    }
  }
  if (totalW > 0) { variance[0] /= totalW; variance[1] /= totalW; variance[2] /= totalW }
  const spread: [number, number, number] = [
    Math.sqrt(variance[0]),
    Math.sqrt(variance[1]),
    Math.sqrt(variance[2]),
  ]

  const gyrationRadius = Math.sqrt(variance[0] + variance[1] + variance[2])

  return {
    occupancy,
    totalVoxels,
    occupied,
    maxDensity,
    meanDensity,
    centroid,
    spread,
    gyrationRadius,
  }
}

function computeMetrics(pts: number[][]): VoxelMetrics | null {
  const gridStats = computeGridStats(pts)
  if (!gridStats) return null

  const shape = computeShapeMetrics(pts, Date.now())
  if (!shape) return null

  const NUM_SHELLS = 6
  const maxR = Math.sqrt(3) * 0.5
  const radialShellsDetailed = shape.radialShells.map((fraction, i) => ({
    r: ((i + 0.5) / NUM_SHELLS) * maxR,
    count: 0,
    fraction,
  }))

  return { grid: gridStats, shape, radialShellsDetailed }
}

function fmt(v: number, decimals = 3): string {
  return v.toFixed(decimals)
}

function ShellBar({ shell, maxFraction }: { shell: { r: number; fraction: number }; maxFraction: number }) {
  const width = maxFraction > 0 ? (shell.fraction / maxFraction) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-right font-mono text-[10px] text-[#62666d]">{fmt(shell.r, 2)}</span>
      <div className="relative h-[6px] flex-1 rounded-full bg-[rgba(255,255,255,0.03)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#7170ff]"
          style={{ width: `${width}%`, opacity: 0.3 + 0.7 * (shell.fraction / (maxFraction || 1)) }}
        />
      </div>
      <span className="w-12 text-right font-mono text-[10px] text-[#8a8f98]">{(shell.fraction * 100).toFixed(1)}%</span>
    </div>
  )
}

export const VoxelStructurePanel = memo(function VoxelStructurePanel({ pts }: VoxelStructurePanelProps) {
  const metrics = useMemo(() => computeMetrics(pts), [pts])

  if (!metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[11px] text-[#34343a]">Awaiting embedding data&hellip;</span>
      </div>
    )
  }

  const { grid: g, shape: s, radialShellsDetailed } = metrics
  const maxShellFrac = Math.max(...radialShellsDetailed.map((sh) => sh.fraction))

  return (
    <Accordion type="multiple" defaultValue={['occupancy']}>
      <AccordionItem value="occupancy">
        <AccordionTrigger>Occupancy Grid</AccordionTrigger>
        <AccordionContent>
          <Desc>How many voxels in the 20\u00b3 grid contain attractor points, and how unevenly mass concentrates across occupied cells.</Desc>
          <div className="space-y-1">
            <MetricRow label="Occupied" value={`${g.occupied} / ${g.totalVoxels}`} />
            <MetricRow label="Fill ratio" value={`${(g.occupancy * 100).toFixed(1)}%`} />
            <MetricRow label="Peak density" value={`${g.maxDensity}`} accent />
            <MetricRow label="Mean density" value={fmt(g.meanDensity, 1)} />
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="centroid">
        <AccordionTrigger>3D Centroid Position</AccordionTrigger>
        <AccordionContent>
          <Desc>Mass-weighted center of the attractor in normalized embedding coordinates. Values near 0.5 indicate a centered distribution.</Desc>
          <div className="space-y-1">
            <MetricRow label="X" value={fmt(g.centroid[0])} />
            <MetricRow label="Y" value={fmt(g.centroid[1])} />
            <MetricRow label="Z" value={fmt(g.centroid[2])} />
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="spread">
        <AccordionTrigger>Coordinate Spread (\u03C3)</AccordionTrigger>
        <AccordionContent>
          <Desc>Per-axis standard deviation of density mass. The radius of gyration R_gyr measures the overall spatial extent of the attractor cloud.</Desc>
          <div className="space-y-1">
            <MetricRow label="\u03C3_x" value={fmt(g.spread[0])} />
            <MetricRow label="\u03C3_y" value={fmt(g.spread[1])} />
            <MetricRow label="\u03C3_z" value={fmt(g.spread[2])} />
            <MetricRow label="R_gyr" value={fmt(g.gyrationRadius)} accent />
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="shells">
        <AccordionTrigger>Radial Shell Distribution</AccordionTrigger>
        <AccordionContent>
          <Desc>Mass fraction in concentric shells from the density centroid. Reveals whether the attractor is core-heavy, hollow, or uniformly distributed.</Desc>
          <div className="space-y-1">
            {radialShellsDetailed.map((shell, i) => (
              <ShellBar key={i} shell={shell} maxFraction={maxShellFrac} />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="structure">
        <AccordionTrigger>Hidden Structural Geometry</AccordionTrigger>
        <AccordionContent>
          <Desc>Composite measures that reveal the attractor's hidden shape: rotational symmetry, directional elongation, shell hollowness, and packing density.</Desc>
          <div className="space-y-1">
            <MetricRow label="Symmetry" value={fmt(s.symmetry, 2)} accent color={symmetryColor(s.symmetry)} />
            <MetricRow label="Anisotropy" value={fmt(s.anisotropy, 3)} />
            <MetricRow label="Hollowness" value={fmt(s.hollowness, 3)} />
            <MetricRow label="Compactness" value={fmt(s.compactness, 3)} />
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="entropy">
        <AccordionTrigger>Information-Theoretic Patterns</AccordionTrigger>
        <AccordionContent>
          <Desc>Shannon entropy of the voxel density distribution and lacunarity (gap texture). Low entropy signals the attractor collapses onto a low-dimensional manifold.</Desc>
          <div className="space-y-1">
            <MetricRow label="Density entropy" value={`${fmt(s.densityEntropy, 2)} bits`} accent />
            <MetricRow label="Lacunarity (\u039B)" value={fmt(s.lacunarity, 3)} />
          </div>
          <p className="mt-1.5 text-[9px] leading-relaxed text-[#4a4d54]">
            {interpretEntropy(s.densityEntropy, Math.log2(g.occupied))}
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="asymmetry">
        <AccordionTrigger>Axis Asymmetry</AccordionTrigger>
        <AccordionContent>
          <Desc>Fractional mass imbalance across each embedding axis. High values expose directional bias in the attractor's structure.</Desc>
          <div className="space-y-1">
            <MetricRow label="X asym" value={fmt(s.axisAsymmetry[0], 3)} />
            <MetricRow label="Y asym" value={fmt(s.axisAsymmetry[1], 3)} />
            <MetricRow label="Z asym" value={fmt(s.axisAsymmetry[2], 3)} />
          </div>
          <p className="mt-1.5 text-[9px] leading-relaxed text-[#4a4d54]">
            {interpretAsymmetry(s.axisAsymmetry)}
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="extents" className="border-b-0">
        <AccordionTrigger>Principal Extents</AccordionTrigger>
        <AccordionContent>
          <Desc>Eigenvalue-ordered spread along the three principal axes. Their ratios classify the attractor as spherical, oblate, prolate, or triaxial.</Desc>
          <div className="space-y-1">
            <MetricRow label="\u03BB\u2081" value={fmt(s.principalExtents[0])} accent />
            <MetricRow label="\u03BB\u2082" value={fmt(s.principalExtents[1])} />
            <MetricRow label="\u03BB\u2083" value={fmt(s.principalExtents[2])} />
          </div>
          <p className="mt-1.5 text-[9px] leading-relaxed text-[#4a4d54]">
            {interpretShape(s.principalExtents)}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
})

function Desc({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] leading-relaxed text-[#62666d]">
      {children}
    </p>
  )
}

function MetricRow({
  label,
  value,
  accent,
  color,
}: {
  label: string
  value: string
  accent?: boolean
  color?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-[6px] border border-[rgba(255,255,255,0.05)] bg-[#08090a] px-2.5 py-1.5">
      <span className="text-[10px] font-[510] tracking-[0.04em] text-[#62666d]">{label}</span>
      <span
        className={`font-mono text-[13px] font-[510] ${accent ? 'text-[#7170ff]' : 'text-[#d0d6e0]'}`}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

function symmetryColor(score: number): string {
  if (score > 0.85) return '#7170ff'
  if (score > 0.6) return '#8a8f98'
  return '#62666d'
}

function interpretEntropy(entropy: number, maxEntropy: number): string {
  const ratio = maxEntropy > 0 ? entropy / maxEntropy : 0
  if (ratio > 0.9) return 'Near-uniform density \u2192 diffuse attractor, weak structure.'
  if (ratio > 0.7) return 'Moderate concentration \u2192 localized density pockets visible.'
  if (ratio > 0.4) return 'Concentrated density \u2192 strong structural clustering in voxel space.'
  return 'Highly concentrated \u2192 attractor collapses to narrow manifold.'
}

function interpretAsymmetry(asym: [number, number, number]): string {
  const max = Math.max(...asym)
  const axis = asym.indexOf(max)
  const labels = ['X', 'Y', 'Z']
  if (max < 0.1) return 'Near-symmetric density across all axes \u2192 isotropic attractor.'
  if (max < 0.3) return `Mild ${labels[axis]}-axis bias \u2192 slight directional preference.`
  return `Strong ${labels[axis]}-axis asymmetry \u2192 attractor skewed in embedding space.`
}

function interpretShape(extents: [number, number, number]): string {
  if (extents[0] <= 0) return ''
  const ratio12 = extents[1] / extents[0]
  const ratio13 = extents[2] / extents[0]
  if (ratio12 > 0.8 && ratio13 > 0.8) return 'Spherical geometry \u2192 isotropic dynamics.'
  if (ratio12 > 0.8 && ratio13 < 0.4) return 'Oblate (disc-like) \u2192 planar attractor structure.'
  if (ratio12 < 0.4 && ratio13 < 0.4) return 'Prolate (cigar-like) \u2192 linear manifold geometry.'
  return 'Triaxial ellipsoid \u2192 anisotropic attractor with distinct principal axes.'
}
