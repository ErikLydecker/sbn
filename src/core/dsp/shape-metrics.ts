export interface ShapeMetrics {
  symmetry: number
  anisotropy: number
  hollowness: number
  compactness: number
  radialShells: number[]
  axisAsymmetry: [number, number, number]
  principalExtents: [number, number, number]
  densityEntropy: number
  lacunarity: number
  timestamp: number
}

const GRID = 20
const NUM_SHELLS = 6

export function computeShapeMetrics(pts: number[][], timestamp: number): ShapeMetrics | null {
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

  let occupied = 0
  let totalW = 0
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]! > 0) {
      occupied++
      totalW += grid[i]!
    }
  }
  const totalVoxels = GRID * GRID * GRID
  const occupancy = occupied / totalVoxels

  const cx: [number, number, number] = [0, 0, 0]
  for (let ix = 0; ix < GRID; ix++) {
    for (let iy = 0; iy < GRID; iy++) {
      for (let iz = 0; iz < GRID; iz++) {
        const d = grid[ix * GRID * GRID + iy * GRID + iz]!
        if (d < 1) continue
        cx[0] += d * (ix + 0.5) / GRID
        cx[1] += d * (iy + 0.5) / GRID
        cx[2] += d * (iz + 0.5) / GRID
      }
    }
  }
  if (totalW > 0) { cx[0] /= totalW; cx[1] /= totalW; cx[2] /= totalW }

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

  const gyrationRadius = Math.sqrt(variance[0] + variance[1] + variance[2])

  const sortedVar = [variance[0], variance[1], variance[2]].sort((a, b) => b - a)
  const principalExtents: [number, number, number] = [
    Math.sqrt(sortedVar[0]!),
    Math.sqrt(sortedVar[1]!),
    Math.sqrt(sortedVar[2]!),
  ]

  const shellCounts = new Array(NUM_SHELLS).fill(0) as number[]
  const maxR = Math.sqrt(3) * 0.5
  for (let ix = 0; ix < GRID; ix++) {
    for (let iy = 0; iy < GRID; iy++) {
      for (let iz = 0; iz < GRID; iz++) {
        const d = grid[ix * GRID * GRID + iy * GRID + iz]!
        if (d < 1) continue
        const r = Math.sqrt(
          ((ix + 0.5) / GRID - cx[0]) ** 2 +
          ((iy + 0.5) / GRID - cx[1]) ** 2 +
          ((iz + 0.5) / GRID - cx[2]) ** 2,
        )
        const shell = Math.min(NUM_SHELLS - 1, Math.floor((r / maxR) * NUM_SHELLS))
        shellCounts[shell] = shellCounts[shell]! + d
      }
    }
  }
  const shellTotal = shellCounts.reduce((a, b) => a + b, 0) || 1
  const radialShells = shellCounts.map((c) => c / shellTotal)

  const innerShellFraction = radialShells[0]!
  const outerShellFraction = radialShells[radialShells.length - 1]!
  const hollowness = occupied > 0
    ? Math.max(0, 1 - innerShellFraction / (outerShellFraction || 0.001))
    : 0

  const axisPos: [number, number, number] = [0, 0, 0]
  const axisNeg: [number, number, number] = [0, 0, 0]
  for (let ix = 0; ix < GRID; ix++) {
    for (let iy = 0; iy < GRID; iy++) {
      for (let iz = 0; iz < GRID; iz++) {
        const d = grid[ix * GRID * GRID + iy * GRID + iz]!
        if (d < 1) continue
        const px = (ix + 0.5) / GRID
        const py = (iy + 0.5) / GRID
        const pz = (iz + 0.5) / GRID
        px >= cx[0] ? (axisPos[0] += d) : (axisNeg[0] += d)
        py >= cx[1] ? (axisPos[1] += d) : (axisNeg[1] += d)
        pz >= cx[2] ? (axisPos[2] += d) : (axisNeg[2] += d)
      }
    }
  }
  const axisAsymmetry: [number, number, number] = [
    (axisPos[0] + axisNeg[0]) > 0 ? Math.abs(axisPos[0] - axisNeg[0]) / (axisPos[0] + axisNeg[0]) : 0,
    (axisPos[1] + axisNeg[1]) > 0 ? Math.abs(axisPos[1] - axisNeg[1]) / (axisPos[1] + axisNeg[1]) : 0,
    (axisPos[2] + axisNeg[2]) > 0 ? Math.abs(axisPos[2] - axisNeg[2]) / (axisPos[2] + axisNeg[2]) : 0,
  ]

  let densityEntropy = 0
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]! > 0) {
      const p = grid[i]! / totalW
      densityEntropy -= p * Math.log2(p)
    }
  }

  const densities = Array.from(grid).filter((d) => d > 0)
  const mean2 = densities.reduce((a, b) => a + b, 0) / densities.length
  const variance2 = densities.reduce((a, b) => a + (b - mean2) ** 2, 0) / densities.length
  const lacunarity = mean2 > 0 ? variance2 / (mean2 * mean2) : 0

  const compactness = occupancy > 0 ? occupancy / (gyrationRadius || 0.001) : 0

  const symmetry = 1 - (axisAsymmetry[0] + axisAsymmetry[1] + axisAsymmetry[2]) / 3
  const anisotropy = principalExtents[0] > 0
    ? 1 - principalExtents[2] / principalExtents[0]
    : 0

  return {
    symmetry,
    anisotropy,
    hollowness,
    compactness,
    radialShells,
    axisAsymmetry,
    principalExtents,
    densityEntropy,
    lacunarity,
    timestamp,
  }
}
