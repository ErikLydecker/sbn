import { useRef, useMemo, useState, useEffect, useCallback, memo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import * as THREE from 'three'
import { Play, Pause, Radio, Eye, EyeOff, CircleDot } from 'lucide-react'
import type { ShapeMetrics } from '@/core/dsp/shape-metrics'
import { useTopologyStore } from '@/stores/topology.store'
import { useAnalysisStore } from '@/stores/analysis.store'

const LERP_SPEED = 3.0
const PLAYBACK_INTERVAL_MS = 1200
const WIRE_SEGMENTS = 32

interface MorphingShapeProps {
  target: ShapeMetrics
}

function buildGridLines(segments: number): THREE.BufferGeometry {
  const vertices: number[] = []

  for (let i = 0; i <= segments; i++) {
    const phi = (i / segments) * Math.PI
    const sinPhi = Math.sin(phi)
    const cosPhi = Math.cos(phi)
    for (let j = 0; j < segments * 2; j++) {
      const t0 = (j / (segments * 2)) * Math.PI * 2
      const t1 = ((j + 1) / (segments * 2)) * Math.PI * 2
      vertices.push(
        sinPhi * Math.cos(t0), cosPhi, sinPhi * Math.sin(t0),
        sinPhi * Math.cos(t1), cosPhi, sinPhi * Math.sin(t1),
      )
    }
  }

  for (let j = 0; j < segments * 2; j++) {
    const theta = (j / (segments * 2)) * Math.PI * 2
    const cosT = Math.cos(theta)
    const sinT = Math.sin(theta)
    for (let i = 0; i < segments; i++) {
      const p0 = (i / segments) * Math.PI
      const p1 = ((i + 1) / segments) * Math.PI
      vertices.push(
        Math.sin(p0) * cosT, Math.cos(p0), Math.sin(p0) * sinT,
        Math.sin(p1) * cosT, Math.cos(p1), Math.sin(p1) * sinT,
      )
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  return geo
}

function MorphingShape({ target }: MorphingShapeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const wireRef = useRef<THREE.LineSegments>(null)
  const innerRef = useRef<THREE.Mesh>(null)
  const currentRef = useRef({
    extents: [1, 1, 1] as [number, number, number],
    asymOffset: [0, 0, 0] as [number, number, number],
    hollowness: 0,
    entropy: 0.5,
  })

  const baseGeometry = useMemo(() => new THREE.SphereGeometry(1, 64, 64), [])
  const basePositions = useMemo(() => new Float32Array(baseGeometry.attributes.position!.array), [baseGeometry])

  const shellColors = useMemo(() => {
    const colors = new Float32Array(baseGeometry.attributes.position!.count * 3)
    baseGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return colors
  }, [baseGeometry])

  const wireGeometry = useMemo(() => buildGridLines(WIRE_SEGMENTS), [])
  const wireBasePositions = useMemo(() => new Float32Array(wireGeometry.attributes.position!.array), [wireGeometry])

  useFrame((_, delta) => {
    const cur = currentRef.current
    const dt = Math.min(delta * LERP_SPEED, 1)

    const maxE = Math.max(target.principalExtents[0], 0.01)
    const te: [number, number, number] = [
      target.principalExtents[0] / maxE,
      target.principalExtents[1] / maxE,
      target.principalExtents[2] / maxE,
    ]
    cur.extents[0] += (te[0] - cur.extents[0]) * dt
    cur.extents[1] += (te[1] - cur.extents[1]) * dt
    cur.extents[2] += (te[2] - cur.extents[2]) * dt
    for (let d = 0; d < 3; d++) {
      const idx = d as 0 | 1 | 2
      const t = (target.axisAsymmetry[idx] - 0.5) * 0.3
      cur.asymOffset[idx] += (t - cur.asymOffset[idx]) * dt
    }
    cur.hollowness += (target.hollowness - cur.hollowness) * dt
    cur.entropy += (target.densityEntropy - cur.entropy) * dt

    const noiseScale = Math.max(0.01, 0.15 * (1 - Math.min(cur.entropy / 10, 1)))

    if (meshRef.current) {
      const posArray = meshRef.current.geometry.attributes.position!.array as Float32Array
      for (let i = 0; i < posArray.length; i += 3) {
        const bx = basePositions[i]!
        const by = basePositions[i + 1]!
        const bz = basePositions[i + 2]!
        const noise = Math.sin(bx * 8 + by * 5) * Math.cos(bz * 7 + bx * 3) * noiseScale

        posArray[i] = bx * cur.extents[0]! * (1 + noise) + cur.asymOffset[0]!
        posArray[i + 1] = by * cur.extents[1]! * (1 + noise) + cur.asymOffset[1]!
        posArray[i + 2] = bz * cur.extents[2]! * (1 + noise) + cur.asymOffset[2]!
      }
      meshRef.current.geometry.attributes.position!.needsUpdate = true
      meshRef.current.geometry.computeVertexNormals()

      const teal = new THREE.Color(0x40e0d0)
      const purple = new THREE.Color(0x7170ff)
      const orange = new THREE.Color(0xff8844)
      const shells = target.radialShells
      const maxShell = Math.max(...shells, 0.01)

      for (let i = 0; i < posArray.length / 3; i++) {
        const px = posArray[i * 3]!
        const py = posArray[i * 3 + 1]!
        const pz = posArray[i * 3 + 2]!
        const dist = Math.sqrt(px * px + py * py + pz * pz)
        const maxDist = Math.max(cur.extents[0]!, cur.extents[1]!, cur.extents[2]!)
        const t = Math.min(dist / (maxDist || 1), 1)

        const shellIdx = Math.min(shells.length - 1, Math.floor(t * shells.length))
        const shellDensity = (shells[shellIdx] ?? 0) / maxShell

        const color = new THREE.Color()
        if (t < 0.5) color.lerpColors(teal, purple, t * 2)
        else color.lerpColors(purple, orange, (t - 0.5) * 2)
        color.lerp(new THREE.Color(0x111122), 1 - shellDensity * 0.7 - 0.3)

        shellColors[i * 3] = color.r
        shellColors[i * 3 + 1] = color.g
        shellColors[i * 3 + 2] = color.b
      }
      meshRef.current.geometry.attributes.color!.needsUpdate = true
    }

    if (wireRef.current) {
      const posArray = wireRef.current.geometry.attributes.position!.array as Float32Array
      for (let i = 0; i < posArray.length; i += 3) {
        const bx = wireBasePositions[i]!
        const by = wireBasePositions[i + 1]!
        const bz = wireBasePositions[i + 2]!
        const noise = Math.sin(bx * 8 + by * 5) * Math.cos(bz * 7 + bx * 3) * noiseScale
        posArray[i] = bx * cur.extents[0]! * 1.002 * (1 + noise) + cur.asymOffset[0]!
        posArray[i + 1] = by * cur.extents[1]! * 1.002 * (1 + noise) + cur.asymOffset[1]!
        posArray[i + 2] = bz * cur.extents[2]! * 1.002 * (1 + noise) + cur.asymOffset[2]!
      }
      wireRef.current.geometry.attributes.position!.needsUpdate = true
    }

    if (innerRef.current) {
      const s = 0.55
      innerRef.current.scale.set(cur.extents[0]! * s, cur.extents[1]! * s, cur.extents[2]! * s)
      innerRef.current.position.set(cur.asymOffset[0]!, cur.asymOffset[1]!, cur.asymOffset[2]!)
      ;(innerRef.current.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.06 * (1 - cur.hollowness))
    }
  })

  return (
    <group renderOrder={0}>
      <mesh ref={meshRef} geometry={baseGeometry}>
        <meshStandardMaterial vertexColors transparent opacity={0.25} side={THREE.DoubleSide} roughness={0.6} metalness={0.2} depthWrite={false} />
      </mesh>

      <lineSegments ref={wireRef} geometry={wireGeometry}>
        <lineBasicMaterial color={0x40e0d0} transparent opacity={0.45} depthWrite={false} />
      </lineSegments>

      <mesh ref={innerRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={0x7170ff} transparent opacity={0.06} emissive={0x7170ff} emissiveIntensity={0.15} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

const DENSITY_GRID = 12
const ATTRACTOR_LERP = 4.0
const MAX_PTS = 600

function mapPoints(pts: number[][], ext: [number, number, number]): Float32Array {
  const out = new Float32Array(pts.length * 3)
  if (pts.length < 4) return out

  let mnX = Infinity, mxX = -Infinity
  let mnY = Infinity, mxY = -Infinity
  let mnZ = Infinity, mxZ = -Infinity
  for (const p of pts) {
    const x = p[0]!, y = p[1]!, z = p[2] ?? 0
    if (x < mnX) mnX = x; if (x > mxX) mxX = x
    if (y < mnY) mnY = y; if (y > mxY) mxY = y
    if (z < mnZ) mnZ = z; if (z > mxZ) mxZ = z
  }
  const cx = (mnX + mxX) / 2, cy = (mnY + mxY) / 2, cz = (mnZ + mxZ) / 2
  const maxRange = Math.max(mxX - mnX || 1, mxY - mnY || 1, mxZ - mnZ || 1)
  const fitScale = 0.85 / (maxRange / 2)

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    out[i * 3] = (p[0]! - cx) * fitScale * ext[0]
    out[i * 3 + 1] = (p[1]! - cy) * fitScale * ext[1]
    out[i * 3 + 2] = ((p[2] ?? 0) - cz) * fitScale * ext[2]
  }
  return out
}

function computeGlow(mapped: Float32Array, n: number) {
  const densityMap = new Map<string, { x: number; y: number; z: number; count: number }>()
  const cellSize = 2.0 / DENSITY_GRID
  for (let i = 0; i < n; i++) {
    const x = mapped[i * 3]!, y = mapped[i * 3 + 1]!, z = mapped[i * 3 + 2]!
    const gx = Math.floor((x + 1) / cellSize)
    const gy = Math.floor((y + 1) / cellSize)
    const gz = Math.floor((z + 1) / cellSize)
    const key = `${gx},${gy},${gz}`
    const existing = densityMap.get(key)
    if (existing) { existing.count++; existing.x += x; existing.y += y; existing.z += z }
    else densityMap.set(key, { x, y, z, count: 1 })
  }

  let maxD = 1
  for (const c of densityMap.values()) if (c.count > maxD) maxD = c.count

  const result: { pos: [number, number, number]; density: number }[] = []
  for (const c of densityMap.values()) {
    if (c.count < 2) continue
    result.push({ pos: [c.x / c.count, c.y / c.count, c.z / c.count], density: c.count / maxD })
  }
  return result
}

function AttractorOverlay({ pts, shapeExtents }: { pts: number[][]; shapeExtents: [number, number, number] }) {
  const currentRef = useRef<Float32Array>(new Float32Array(MAX_PTS * 3))
  const targetRef = useRef<Float32Array>(new Float32Array(0))
  const countRef = useRef(0)
  const headRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Points>(null)

  const target = useMemo(() => mapPoints(pts, shapeExtents), [pts, shapeExtents])

  useEffect(() => {
    targetRef.current = target
    countRef.current = Math.floor(target.length / 3)
    if (currentRef.current.length < target.length) {
      const bigger = new Float32Array(target.length)
      bigger.set(currentRef.current)
      currentRef.current = bigger
    }
  }, [target])

  const glowTexture = useMemo(() => {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(113, 112, 255, 1)')
    gradient.addColorStop(0.3, 'rgba(113, 112, 255, 0.5)')
    gradient.addColorStop(0.6, 'rgba(64, 224, 208, 0.15)')
    gradient.addColorStop(1, 'rgba(64, 224, 208, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(canvas)
  }, [])

  const lineColors = useMemo(() => {
    const n = pts.length || 1
    const colors: [number, number, number][] = []
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      colors.push([0.25 + t * 0.2, 0.15 + t * 0.3, 0.55 + t * 0.45])
    }
    return colors
  }, [pts.length])

  const [lerpedPoints, setLerpedPoints] = useState<[number, number, number][]>([])

  useFrame((_, delta) => {
    const cur = currentRef.current
    const tgt = targetRef.current
    const n = countRef.current
    if (n < 4) return

    const dt = Math.min(delta * ATTRACTOR_LERP, 1)
    for (let i = 0; i < n * 3; i++) {
      cur[i] = (cur[i] ?? 0) + ((tgt[i] ?? 0) - (cur[i] ?? 0)) * dt
    }

    const pts3: [number, number, number][] = []
    for (let i = 0; i < n; i++) {
      pts3.push([cur[i * 3] ?? 0, cur[i * 3 + 1] ?? 0, cur[i * 3 + 2] ?? 0])
    }
    setLerpedPoints(pts3)

    if (headRef.current && n > 0) {
      const li = n - 1
      headRef.current.position.set(cur[li * 3] ?? 0, cur[li * 3 + 1] ?? 0, cur[li * 3 + 2] ?? 0)
    }

    if (glowRef.current) {
      const glow = computeGlow(cur, n)
      const posArr = new Float32Array(glow.length * 3)
      for (let i = 0; i < glow.length; i++) {
        posArr[i * 3] = glow[i]!.pos[0]
        posArr[i * 3 + 1] = glow[i]!.pos[1]
        posArr[i * 3 + 2] = glow[i]!.pos[2]
      }
      glowRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
      glowRef.current.geometry.setDrawRange(0, glow.length)
    }
  })

  if (countRef.current < 4 && lerpedPoints.length < 4) return null

  return (
    <group renderOrder={10}>
      {lerpedPoints.length >= 4 && (
        <Line
          points={lerpedPoints}
          vertexColors={lineColors}
          lineWidth={2.5}
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
        />
      )}

      <points ref={glowRef} renderOrder={11}>
        <bufferGeometry />
        <pointsMaterial
          map={glowTexture}
          size={0.15}
          transparent
          opacity={0.4}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      <mesh ref={headRef} renderOrder={12}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshStandardMaterial color={0xaaaaff} emissive={0x7170ff} emissiveIntensity={2} depthTest={false} />
      </mesh>
    </group>
  )
}

const SKELETON_SPHERE = new THREE.SphereGeometry(1, 8, 8)
const SKELETON_MAT = new THREE.MeshStandardMaterial({
  color: 0x7170ff,
  emissive: 0x7170ff,
  emissiveIntensity: 0.6,
  transparent: true,
  opacity: 0.7,
  depthTest: false,
  depthWrite: false,
})
const _dummy = new THREE.Object3D()
const _color = new THREE.Color()

function AttractorSkeleton({ pts, shapeExtents }: { pts: number[][]; shapeExtents: [number, number, number] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const currentRef = useRef<Float32Array>(new Float32Array(MAX_PTS * 3))
  const targetRef = useRef<Float32Array>(new Float32Array(0))
  const countRef = useRef(0)

  const target = useMemo(() => mapPoints(pts, shapeExtents), [pts, shapeExtents])

  useEffect(() => {
    targetRef.current = target
    countRef.current = Math.floor(target.length / 3)
    if (currentRef.current.length < target.length) {
      const bigger = new Float32Array(target.length)
      bigger.set(currentRef.current)
      currentRef.current = bigger
    }
  }, [target])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    const cur = currentRef.current
    const tgt = targetRef.current
    const n = countRef.current
    if (!mesh || n < 4) return

    const dt = Math.min(delta * ATTRACTOR_LERP, 1)
    for (let i = 0; i < n * 3; i++) {
      cur[i] = (cur[i] ?? 0) + ((tgt[i] ?? 0) - (cur[i] ?? 0)) * dt
    }

    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const radius = 0.006 + t * 0.008

      _dummy.position.set(cur[i * 3] ?? 0, cur[i * 3 + 1] ?? 0, cur[i * 3 + 2] ?? 0)
      _dummy.scale.setScalar(radius)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)

      _color.setRGB(0.3 + t * 0.15, 0.25 + t * 0.2, 0.7 + t * 0.3)
      mesh.setColorAt(i, _color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.count = n
  })

  if (countRef.current < 4) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[SKELETON_SPHERE, SKELETON_MAT, MAX_PTS]}
      renderOrder={9}
    />
  )
}

function Particles() {
  const pointsRef = useRef<THREE.Points>(null)
  const count = 200

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 6
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6
    }
    return pos
  }, [])

  useFrame((state) => {
    if (!pointsRef.current) return
    const time = state.clock.elapsedTime
    const arr = pointsRef.current.geometry.attributes.position!.array as Float32Array
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] = (arr[i * 3 + 1] ?? 0) + Math.sin(time + i) * 0.0005
    }
    pointsRef.current.geometry.attributes.position!.needsUpdate = true
    pointsRef.current.rotation.y = time * 0.02
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={0x40e0d0} size={0.015} transparent opacity={0.3} sizeAttenuation />
    </points>
  )
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export const ShapeViewer = memo(function ShapeViewer() {
  const shapeHistory = useTopologyStore((s) => s.shapeHistory)
  const currentShape = useTopologyStore((s) => s.currentShape)
  const embeddingVecs = useAnalysisStore((s) => s.smooth?.embeddingVecs)

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLive, setIsLive] = useState(true)
  const [showAttractor, setShowAttractor] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const activeShape = useMemo(() => {
    if (isLive || selectedIdx === null) return currentShape
    return shapeHistory[selectedIdx] ?? currentShape
  }, [isLive, selectedIdx, currentShape, shapeHistory])

  const shapeExtents = useMemo<[number, number, number]>(() => {
    if (!activeShape) return [1, 1, 1]
    const maxE = Math.max(activeShape.principalExtents[0], 0.01)
    return [
      activeShape.principalExtents[0] / maxE,
      activeShape.principalExtents[1] / maxE,
      activeShape.principalExtents[2] / maxE,
    ]
  }, [activeShape])

  useEffect(() => {
    if (isLive && shapeHistory.length > 0) {
      setSelectedIdx(shapeHistory.length - 1)
    }
  }, [isLive, shapeHistory.length])

  useEffect(() => {
    if (!isPlaying) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
      return
    }

    setIsLive(false)
    let idx = selectedIdx ?? 0

    playIntervalRef.current = setInterval(() => {
      idx++
      if (idx >= shapeHistory.length) {
        idx = shapeHistory.length - 1
        setIsPlaying(false)
        setIsLive(true)
      }
      setSelectedIdx(idx)
    }, PLAYBACK_INTERVAL_MS)

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current)
    }
  }, [isPlaying, shapeHistory.length])

  const handleTimelineClick = useCallback((idx: number) => {
    setIsPlaying(false)
    setIsLive(false)
    setSelectedIdx(idx)
  }, [])

  const handleGoLive = useCallback(() => {
    setIsPlaying(false)
    setIsLive(true)
    setSelectedIdx(shapeHistory.length - 1)
  }, [shapeHistory.length])

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false)
    } else {
      if (isLive) setSelectedIdx(0)
      setIsPlaying(true)
    }
  }, [isPlaying, isLive])

  if (!activeShape) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#08090a]">
        <div className="text-center">
          <div className="mb-2 text-[13px] text-[#62666d]">Awaiting shape data...</div>
          <div className="text-[10px] text-[#34343a]">Shape metrics compute after the first embedding window fills</div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full bg-[#08090a]">
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: '#08090a' }}
      >
        <ambientLight intensity={0.15} />
        <pointLight position={[5, 5, 5]} intensity={0.6} color={0x40e0d0} />
        <pointLight position={[-5, -3, -5]} intensity={0.3} color={0xff8844} />
        <pointLight position={[0, 5, -3]} intensity={0.2} color={0x7170ff} />

        <MorphingShape target={activeShape} />
        {showAttractor && embeddingVecs && embeddingVecs.length >= 4 && (
          <AttractorOverlay pts={embeddingVecs} shapeExtents={shapeExtents} />
        )}
        {showSkeleton && embeddingVecs && embeddingVecs.length >= 4 && (
          <AttractorSkeleton pts={embeddingVecs} shapeExtents={shapeExtents} />
        )}
        <Particles />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
          minDistance={1.5}
          maxDistance={10}
          autoRotate
          autoRotateSpeed={0.4}
        />
      </Canvas>

      {/* HUD overlay - top left */}
      <div className="pointer-events-none absolute left-4 top-4 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-[590] uppercase tracking-[0.08em] text-[#62666d]">
            Attractor Shape
          </span>
          {isLive && (
            <span className="flex items-center gap-1 rounded bg-[rgba(80,221,128,0.12)] px-1.5 py-0.5 text-[9px] font-[590] text-[#50dd80]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#50dd80]" />
              LIVE
            </span>
          )}
        </div>
        <HudMetric label="Symmetry" value={activeShape.symmetry.toFixed(2)} />
        <HudMetric label="Anisotropy" value={activeShape.anisotropy.toFixed(3)} />
        <HudMetric label="Hollowness" value={activeShape.hollowness.toFixed(3)} />
        <HudMetric label="Compactness" value={activeShape.compactness.toFixed(3)} />
        <HudMetric label="Entropy" value={`${activeShape.densityEntropy.toFixed(1)} bits`} />
        <HudMetric label="Lacunarity" value={activeShape.lacunarity.toFixed(3)} />
      </div>

      {/* Toggle buttons - top right */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5">
        <button
          onClick={() => setShowAttractor((v) => !v)}
          className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[10px] font-[590] uppercase tracking-[0.06em] transition-colors ${
            showAttractor
              ? 'border-[rgba(113,112,255,0.3)] bg-[rgba(113,112,255,0.1)] text-[#7170ff]'
              : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-[#62666d] hover:text-[#d0d6e0]'
          }`}
          title={showAttractor ? 'Hide attractor trajectory' : 'Show attractor trajectory'}
        >
          {showAttractor ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          Attractor
        </button>
        <button
          onClick={() => setShowSkeleton((v) => !v)}
          className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[10px] font-[590] uppercase tracking-[0.06em] transition-colors ${
            showSkeleton
              ? 'border-[rgba(64,224,208,0.3)] bg-[rgba(64,224,208,0.1)] text-[#40e0d0]'
              : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-[#62666d] hover:text-[#d0d6e0]'
          }`}
          title={showSkeleton ? 'Hide skeleton points' : 'Show skeleton points'}
        >
          <CircleDot className="h-3 w-3" />
          Skeleton
        </button>
        {(showAttractor || showSkeleton) && (!embeddingVecs || embeddingVecs.length < 4) && (
          <span className="text-[9px] text-[#4a4d54]">Waiting for live data...</span>
        )}
      </div>

      {/* Timeline playback - bottom */}
      {shapeHistory.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-[rgba(8,9,10,0.9)] to-transparent px-4 pb-4 pt-8">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-[#d0d6e0] transition-colors hover:bg-[rgba(255,255,255,0.1)]"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
            </button>

            <div className="flex flex-1 items-center gap-1">
              {shapeHistory.map((shape, idx) => {
                const isActive = isLive ? idx === shapeHistory.length - 1 : idx === selectedIdx
                return (
                  <button
                    key={shape.timestamp}
                    onClick={() => handleTimelineClick(idx)}
                    className="group relative flex-1"
                    title={formatTime(shape.timestamp)}
                  >
                    <div
                      className={`mx-auto h-1.5 rounded-full transition-all ${
                        isActive
                          ? 'w-full bg-[#40e0d0] shadow-[0_0_6px_rgba(64,224,208,0.4)]'
                          : idx <= (selectedIdx ?? shapeHistory.length - 1)
                            ? 'w-full bg-[#7170ff] opacity-60'
                            : 'w-full bg-[rgba(255,255,255,0.1)]'
                      }`}
                    />
                    {isActive && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#1a1b1e] px-1.5 py-0.5 text-[9px] text-[#8a8f98]">
                        {formatTime(shape.timestamp)}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleGoLive}
              className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[10px] font-[590] uppercase tracking-[0.06em] transition-colors ${
                isLive
                  ? 'border-[rgba(80,221,128,0.3)] bg-[rgba(80,221,128,0.1)] text-[#50dd80]'
                  : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-[#62666d] hover:text-[#d0d6e0]'
              }`}
            >
              <Radio className="h-3 w-3" />
              Live
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

function HudMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] tracking-[0.04em] text-[#4a4d54]">{label}</span>
      <span className="font-mono text-[10px] text-[#8a8f98]">{value}</span>
    </div>
  )
}
