import { CANVAS_COLORS as C } from '@/config/theme'

const GRID = 20
const ACCENT_RGB: [number, number, number] = [113, 112, 255]

interface Voxel {
  ix: number
  iy: number
  iz: number
  density: number
  depth: number
}

export interface RenderedVoxel {
  ix: number
  iy: number
  iz: number
  density: number
  count: number
  sx: number
  sy: number
  screenRadius: number
}

export interface DrawVoxelResult {
  voxels: RenderedVoxel[]
}

export function drawVoxelDensity(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pts: number[][],
  azimuth: number,
  elevation: number,
  zoom: number,
  hoveredVoxel?: { ix: number; iy: number; iz: number } | null,
  cameraOffset?: [number, number, number] | null,
  hideWireframe?: boolean,
): DrawVoxelResult {
  ctx.clearRect(0, 0, w, h)

  const empty: DrawVoxelResult = { voxels: [] }

  if (pts.length < 4) {
    ctx.fillStyle = C.mutedText
    ctx.font = '11px "Google Sans Code", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Awaiting embedding data\u2026', w / 2, h / 2)
    return empty
  }

  let minV = [Infinity, Infinity, Infinity]
  let maxV = [-Infinity, -Infinity, -Infinity]
  for (const p of pts) {
    for (let d = 0; d < 3; d++) {
      if (p[d]! < minV[d]!) minV[d] = p[d]!
      if (p[d]! > maxV[d]!) maxV[d] = p[d]!
    }
  }

  const range = [
    maxV[0]! - minV[0]! || 1,
    maxV[1]! - minV[1]! || 1,
    maxV[2]! - minV[2]! || 1,
  ]

  const grid = new Float32Array(GRID * GRID * GRID)
  for (const p of pts) {
    const ix = Math.min(GRID - 1, Math.floor(((p[0]! - minV[0]!) / range[0]!) * GRID))
    const iy = Math.min(GRID - 1, Math.floor(((p[1]! - minV[1]!) / range[1]!) * GRID))
    const iz = Math.min(GRID - 1, Math.floor(((p[2]! - minV[2]!) / range[2]!) * GRID))
    const idx = ix * GRID * GRID + iy * GRID + iz
    grid[idx] = grid[idx]! + 1
  }

  let maxDensity = 0
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]! > maxDensity) maxDensity = grid[i]!
  }
  if (maxDensity < 1) return empty

  const cx = w / 2
  const cy = h / 2
  const margin = 30
  const baseScale = (Math.min(w, h) - margin * 2) / 2
  const scale = baseScale * zoom

  const camX = cameraOffset?.[0] ?? 0
  const camY = cameraOffset?.[1] ?? 0
  const camZ = cameraOffset?.[2] ?? 0
  const proj = (x: number, y: number, z: number): [number, number] =>
    project(x - camX, y - camY, z - camZ, azimuth, elevation)

  const cellSize = 1 / GRID
  const voxelScale = 0.55
  const voxels: Voxel[] = []

  for (let ix = 0; ix < GRID; ix++) {
    for (let iy = 0; iy < GRID; iy++) {
      for (let iz = 0; iz < GRID; iz++) {
        const d = grid[ix * GRID * GRID + iy * GRID + iz]!
        if (d < 1) continue

        const px = (ix + 0.5) / GRID - 0.5
        const py = (iy + 0.5) / GRID - 0.5
        const pz = (iz + 0.5) / GRID - 0.5

        const depth = depthOf(px - camX, py - camY, pz - camZ, azimuth, elevation)
        voxels.push({ ix, iy, iz, density: d / maxDensity, depth })
      }
    }
  }

  voxels.sort((a, b) => a.depth - b.depth)

  if (!hideWireframe) {
    drawWireframe(ctx, cx, cy, scale, azimuth, elevation, camX, camY, camZ)
  }

  const hs = (cellSize * voxelScale) / 2
  const cubeCorners: [number, number, number][] = [
    [-hs, -hs, -hs], [hs, -hs, -hs], [hs, hs, -hs], [-hs, hs, -hs],
    [-hs, -hs, hs],  [hs, -hs, hs],  [hs, hs, hs],  [-hs, hs, hs],
  ]
  const faces: { verts: number[]; nx: number; ny: number; nz: number }[] = [
    { verts: [0, 1, 2, 3], nx: 0, ny: 0, nz: -1 },
    { verts: [4, 5, 6, 7], nx: 0, ny: 0, nz: 1 },
    { verts: [0, 1, 5, 4], nx: 0, ny: -1, nz: 0 },
    { verts: [2, 3, 7, 6], nx: 0, ny: 1, nz: 0 },
    { verts: [0, 3, 7, 4], nx: -1, ny: 0, nz: 0 },
    { verts: [1, 2, 6, 5], nx: 1, ny: 0, nz: 0 },
  ]

  const viewDir = viewDirection(azimuth, elevation)
  const screenRadius = hs * scale * 1.2

  const rendered: RenderedVoxel[] = []

  for (const v of voxels) {
    const ox = (v.ix + 0.5) / GRID - 0.5
    const oy = (v.iy + 0.5) / GRID - 0.5
    const oz = (v.iz + 0.5) / GRID - 0.5

    const intensity = Math.pow(v.density, 0.5)
    const isHovered = hoveredVoxel != null &&
      hoveredVoxel.ix === v.ix && hoveredVoxel.iy === v.iy && hoveredVoxel.iz === v.iz

    const projected2d = cubeCorners.map(([dx, dy, dz]) => {
      const [sx2, sy2] = proj(ox + dx, oy + dy, oz + dz)
      return [cx + sx2 * scale, cy + sy2 * scale] as [number, number]
    })

    const [scx, scy] = proj(ox, oy, oz)
    rendered.push({
      ix: v.ix,
      iy: v.iy,
      iz: v.iz,
      density: v.density,
      count: grid[v.ix * GRID * GRID + v.iy * GRID + v.iz]!,
      sx: cx + scx * scale,
      sy: cy + scy * scale,
      screenRadius,
    })

    for (const face of faces) {
      const dot = face.nx * viewDir[0] + face.ny * viewDir[1] + face.nz * viewDir[2]
      if (dot >= 0) continue

      const shade = 0.55 + 0.45 * (-dot)
      let r: number, g: number, b: number, fillAlpha: number

      if (isHovered) {
        r = Math.round(255 * shade)
        g = Math.round(255 * shade)
        b = Math.round(255 * shade)
        fillAlpha = 0.5 + 0.4 * intensity
      } else {
        r = Math.round(ACCENT_RGB[0] * shade * (0.3 + 0.7 * intensity))
        g = Math.round(ACCENT_RGB[1] * shade * (0.3 + 0.7 * intensity))
        b = Math.round(ACCENT_RGB[2] * shade * (0.3 + 0.7 * intensity))
        fillAlpha = 0.12 + 0.6 * intensity
      }

      ctx.beginPath()
      const p0 = projected2d[face.verts[0]!]!
      ctx.moveTo(p0[0], p0[1])
      for (let fi = 1; fi < face.verts.length; fi++) {
        const pf = projected2d[face.verts[fi]!]!
        ctx.lineTo(pf[0], pf[1])
      }
      ctx.closePath()

      ctx.fillStyle = `rgba(${r},${g},${b},${fillAlpha.toFixed(2)})`
      ctx.fill()

      if (isHovered) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'
        ctx.lineWidth = 1
      } else {
        const strokeAlpha = 0.06 + 0.25 * intensity
        ctx.strokeStyle = `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},${strokeAlpha.toFixed(2)})`
        ctx.lineWidth = 0.5
      }
      ctx.stroke()
    }
  }

  if (hoveredVoxel != null) {
    const hv = rendered.find(
      (r) => r.ix === hoveredVoxel.ix && r.iy === hoveredVoxel.iy && r.iz === hoveredVoxel.iz,
    )
    if (hv) {
      drawTooltip(ctx, w, h, hv)
    }
  }

  ctx.font = '8px "Google Sans Code", monospace'
  ctx.fillStyle = C.mutedText
  ctx.textAlign = 'left'
  ctx.fillText(`${voxels.length} / ${GRID}\u00b3 voxels occupied`, 8, h - 6)

  return { voxels: rendered }
}

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  _canvasH: number,
  voxel: RenderedVoxel,
): void {
  const lines = [
    `cell  (${voxel.ix}, ${voxel.iy}, ${voxel.iz})`,
    `count ${voxel.count}`,
    `density ${(voxel.density * 100).toFixed(1)}%`,
  ]

  ctx.font = '10px "Google Sans Code", monospace'
  const padding = 8
  const lineHeight = 14
  const textWidths = lines.map((l) => ctx.measureText(l).width)
  const boxW = Math.max(...textWidths) + padding * 2
  const boxH = lines.length * lineHeight + padding * 2 - 4

  let tx = voxel.sx + 12
  let ty = voxel.sy - boxH / 2
  if (tx + boxW > canvasW - 8) tx = voxel.sx - boxW - 12
  if (ty < 8) ty = 8

  ctx.fillStyle = 'rgba(15,16,17,0.92)'
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 1
  roundRect(ctx, tx, ty, boxW, boxH, 6)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#d0d6e0'
  ctx.textAlign = 'left'
  for (let i = 0; i < lines.length; i++) {
    const color = i === 0 ? '#f7f8f8' : i === 2 ? '#7170ff' : '#8a8f98'
    ctx.fillStyle = color
    ctx.fillText(lines[i], tx + padding, ty + padding + (i + 1) * lineHeight - 4)
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function project(
  x: number, y: number, z: number,
  az: number, el: number,
): [number, number] {
  const ca = Math.cos(az), sa = Math.sin(az)
  const ce = Math.cos(el), se = Math.sin(el)
  return [
    ca * x + sa * z,
    se * (sa * x - ca * z) + ce * y,
  ]
}

function viewDirection(az: number, el: number): [number, number, number] {
  const ca = Math.cos(az), sa = Math.sin(az)
  const ce = Math.cos(el), se = Math.sin(el)
  return [sa * ce, -se, -ca * ce]
}

function depthOf(
  x: number, y: number, z: number,
  az: number, el: number,
): number {
  const ca = Math.cos(az), sa = Math.sin(az)
  const ce = Math.cos(el), se = Math.sin(el)
  return ce * (sa * x - ca * z) - se * y
}

function drawWireframe(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  scale: number,
  az: number, el: number,
  ox: number, oy: number, oz: number,
): void {
  const step = 1 / GRID
  const lo = -0.5
  const hi = 0.5

  const ln = (a: [number, number, number], b: [number, number, number]) =>
    drawLine(ctx, cx, cy, scale, az, el, ox, oy, oz, a, b)

  ctx.strokeStyle = 'rgba(255,255,255,0.025)'
  ctx.lineWidth = 0.5

  for (let i = 1; i < GRID; i++) {
    const t = lo + i * step

    ln([t, lo, lo], [t, hi, lo])
    ln([lo, t, lo], [hi, t, lo])

    ln([t, lo, lo], [t, lo, hi])
    ln([lo, lo, t], [hi, lo, t])

    ln([lo, t, lo], [lo, t, hi])
    ln([lo, lo, t], [lo, hi, t])
  }

  const edges: [[number, number, number], [number, number, number]][] = [
    [[lo, lo, lo], [hi, lo, lo]],
    [[lo, lo, lo], [lo, hi, lo]],
    [[lo, lo, lo], [lo, lo, hi]],
    [[hi, hi, hi], [lo, hi, hi]],
    [[hi, hi, hi], [hi, lo, hi]],
    [[hi, hi, hi], [hi, hi, lo]],
    [[hi, lo, lo], [hi, hi, lo]],
    [[hi, lo, lo], [hi, lo, hi]],
    [[lo, hi, lo], [hi, hi, lo]],
    [[lo, hi, lo], [lo, hi, hi]],
    [[lo, lo, hi], [hi, lo, hi]],
    [[lo, lo, hi], [lo, hi, hi]],
  ]

  ctx.strokeStyle = C.ring100
  ctx.lineWidth = 1

  for (const [a, b] of edges) {
    ln(a, b)
  }
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number,
  az: number, el: number,
  ox: number, oy: number, oz: number,
  a: [number, number, number],
  b: [number, number, number],
): void {
  const [ax, ay] = project(a[0] - ox, a[1] - oy, a[2] - oz, az, el)
  const [bx, by] = project(b[0] - ox, b[1] - oy, b[2] - oz, az, el)
  ctx.beginPath()
  ctx.moveTo(cx + ax * scale, cy + ay * scale)
  ctx.lineTo(cx + bx * scale, cy + by * scale)
  ctx.stroke()
}
