import { useRef, useEffect, useCallback, memo, useImperativeHandle, forwardRef } from 'react'
import { drawVoxelDensity, type RenderedVoxel } from '@/core/dsp/draw-voxel-density'

interface VoxelDensityChartProps {
  pts: number[][]
  height?: number
  fillContainer?: boolean
}

export interface VoxelDensityChartHandle {
  setView: (az: number, el: number) => void
  setAutoRotate: (on: boolean) => void
  setDrone: (on: boolean) => void
  reset: () => void
}

const INITIAL_AZ = 0.6
const INITIAL_EL = 0.3
const INITIAL_ZOOM = 1.0
const DEFAULT_HEIGHT = 320
const AUTO_SPEED = 0.002
const ZOOM_SENSITIVITY = 0.001
const MIN_ZOOM = 0.4
const MAX_ZOOM = 3.0

const DRONE_ZOOM = 6.5
const DRONE_WAYPOINT_COUNT = 12
const DRONE_SPEED = 0.00025
const DRONE_AZ_DRIFT = 0.0015
const DRONE_EL_AMPLITUDE = 0.18

interface DroneState {
  active: boolean
  waypoints: [number, number, number][]
  t: number
  azDrift: number
  elDrift: number
}

function catmullRom(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  t: number,
): [number, number, number] {
  const t2 = t * t
  const t3 = t2 * t
  const out: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    out[i] =
      0.5 * (
        (2 * p1[i]) +
        (-p0[i] + p2[i]) * t +
        (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
        (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3
      )
  }
  return out
}

function generateWaypoints(count: number): [number, number, number][] {
  const pts: [number, number, number][] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const r = 0.08 + Math.random() * 0.15
    const yOff = (Math.random() - 0.5) * 0.2
    pts.push([
      Math.cos(angle) * r + (Math.random() - 0.5) * 0.06,
      yOff,
      Math.sin(angle) * r + (Math.random() - 0.5) * 0.06,
    ])
  }
  return pts
}

function getDronePosition(drone: DroneState): [number, number, number] {
  const n = drone.waypoints.length
  if (n < 4) return [0, 0, 0]

  const total = n
  const seg = drone.t * total
  const idx = Math.floor(seg)
  const frac = seg - idx

  const i0 = ((idx - 1) % n + n) % n
  const i1 = idx % n
  const i2 = (idx + 1) % n
  const i3 = (idx + 2) % n

  return catmullRom(
    drone.waypoints[i0],
    drone.waypoints[i1],
    drone.waypoints[i2],
    drone.waypoints[i3],
    frac,
  )
}

export const VoxelDensityChart = memo(forwardRef<VoxelDensityChartHandle, VoxelDensityChartProps>(
  function VoxelDensityChart({ pts, height, fillContainer }, ref) {
    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const azRef = useRef(INITIAL_AZ)
    const elRef = useRef(INITIAL_EL)
    const zoomRef = useRef(INITIAL_ZOOM)
    const autoRotateRef = useRef(true)
    const dragRef = useRef<{ startX: number; startY: number; startAz: number; startEl: number } | null>(null)
    const rafRef = useRef(0)
    const ptsRef = useRef(pts)
    ptsRef.current = pts
    const hRef = useRef(height ?? DEFAULT_HEIGHT)
    const renderedRef = useRef<RenderedVoxel[]>([])
    const hoveredRef = useRef<{ ix: number; iy: number; iz: number } | null>(null)

    const droneRef = useRef<DroneState>({
      active: false,
      waypoints: [],
      t: 0,
      azDrift: 0,
      elDrift: 0,
    })

    useImperativeHandle(ref, () => ({
      setView(az: number, el: number) {
        droneRef.current.active = false
        azRef.current = az
        elRef.current = el
        zoomRef.current = INITIAL_ZOOM
        autoRotateRef.current = false
      },
      setAutoRotate(on: boolean) {
        droneRef.current.active = false
        autoRotateRef.current = on
        zoomRef.current = INITIAL_ZOOM
      },
      setDrone(on: boolean) {
        if (on) {
          autoRotateRef.current = false
          droneRef.current = {
            active: true,
            waypoints: generateWaypoints(DRONE_WAYPOINT_COUNT),
            t: 0,
            azDrift: Math.random() * Math.PI * 2,
            elDrift: 0.2,
          }
          zoomRef.current = DRONE_ZOOM
        } else {
          droneRef.current.active = false
          zoomRef.current = INITIAL_ZOOM
        }
      },
      reset() {
        droneRef.current.active = false
        azRef.current = INITIAL_AZ
        elRef.current = INITIAL_EL
        zoomRef.current = INITIAL_ZOOM
        autoRotateRef.current = true
      },
    }), [])

    const draw = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = setupCanvas(canvas, hRef.current)
      if (!ctx) return
      const w = canvas.getBoundingClientRect().width

      let camOffset: [number, number, number] | null = null
      const drone = droneRef.current

      if (drone.active) {
        drone.t = (drone.t + DRONE_SPEED) % 1
        drone.azDrift += DRONE_AZ_DRIFT

        azRef.current = drone.azDrift
        elRef.current = Math.sin(drone.t * Math.PI * 6) * DRONE_EL_AMPLITUDE

        camOffset = getDronePosition(drone)
      }

      const result = drawVoxelDensity(
        ctx, w, hRef.current, ptsRef.current,
        azRef.current, elRef.current, zoomRef.current,
        hoveredRef.current,
        camOffset,
        drone.active,
      )
      renderedRef.current = result.voxels
    }, [])

    useEffect(() => {
      if (!fillContainer || !wrapRef.current) return
      const el = wrapRef.current
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (!entry) return
        hRef.current = Math.round(entry.contentRect.height)
      })
      ro.observe(el)
      return () => ro.disconnect()
    }, [fillContainer])

    useEffect(() => {
      hRef.current = height ?? DEFAULT_HEIGHT
    }, [height])

    useEffect(() => {
      let running = true
      const tick = () => {
        if (!running) return
        if (!dragRef.current && autoRotateRef.current && !droneRef.current.active) {
          azRef.current += AUTO_SPEED
        }
        draw()
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
      return () => { running = false; cancelAnimationFrame(rafRef.current) }
    }, [draw])

    useEffect(() => { draw() }, [pts, draw])

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (droneRef.current.active) return
      canvasRef.current?.setPointerCapture(e.pointerId)
      dragRef.current = { startX: e.clientX, startY: e.clientY, startAz: azRef.current, startEl: elRef.current }
      autoRotateRef.current = false
    }, [])

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (droneRef.current.active) return

      if (dragRef.current) {
        azRef.current = dragRef.current.startAz + (e.clientX - dragRef.current.startX) * 0.008
        elRef.current = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, dragRef.current.startEl + (e.clientY - dragRef.current.startY) * 0.008))
        return
      }

      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      let closest: RenderedVoxel | null = null
      let closestDist = Infinity
      for (let i = renderedRef.current.length - 1; i >= 0; i--) {
        const rv = renderedRef.current[i]
        const dx = mx - rv.sx
        const dy = my - rv.sy
        const dist = dx * dx + dy * dy
        if (dist < rv.screenRadius * rv.screenRadius && dist < closestDist) {
          closestDist = dist
          closest = rv
        }
      }

      if (closest) {
        hoveredRef.current = { ix: closest.ix, iy: closest.iy, iz: closest.iz }
        canvas.style.cursor = 'crosshair'
      } else {
        hoveredRef.current = null
        canvas.style.cursor = droneRef.current.active ? 'default' : 'grab'
      }
    }, [])

    const onPointerUp = useCallback(() => { dragRef.current = null }, [])

    const onPointerLeave = useCallback(() => {
      dragRef.current = null
      hoveredRef.current = null
    }, [])

    const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
      if (droneRef.current.active) return
      e.preventDefault()
      zoomRef.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current - e.deltaY * ZOOM_SENSITIVITY))
    }, [])

    const canvas = (
      <canvas
        ref={canvasRef}
        className="w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onWheel={onWheel}
      />
    )

    if (fillContainer) {
      return (
        <div ref={wrapRef} className="h-full w-full">
          {canvas}
        </div>
      )
    }

    return canvas
  },
))

function setupCanvas(canvas: HTMLCanvasElement, h: number): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  if (rect.width < 2 || h < 2) return null
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(dpr, dpr)
  return ctx
}
