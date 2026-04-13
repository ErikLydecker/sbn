import { memo, useMemo } from 'react'
import type { TopologySnapshotRow } from '@/services/persistence/db'
import type { FingerprintMatch } from '@/core/dsp/topology'

const CLASS_COLORS: Record<string, string> = {
  stable_loop: '#50dd80',
  unstable_loop: '#ffaa33',
  drift: '#8a8f98',
  chaotic: '#ff5050',
}

interface TopologyFingerprintTableProps {
  fingerprints: TopologySnapshotRow[]
  currentMatches: FingerprintMatch[]
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    magA += a[i]! * a[i]!
    magB += b[i]! * b[i]!
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom < 1e-12 ? 0 : dot / denom
}

interface RankedRow {
  row: TopologySnapshotRow
  similarity: number
  recurrenceCount: number
}

export const TopologyFingerprintTable = memo(function TopologyFingerprintTable({
  fingerprints,
  currentMatches,
}: TopologyFingerprintTableProps) {
  const ranked = useMemo(() => {
    if (fingerprints.length < 2) return []

    const current = fingerprints[fingerprints.length - 1]!
    const currentVec = current.fingerprintVector
    if (!currentVec || currentVec.length === 0) return []

    const rows: RankedRow[] = []
    for (let i = 0; i < fingerprints.length - 1; i++) {
      const fp = fingerprints[i]!
      if (!fp.fingerprintVector || fp.fingerprintVector.length === 0) continue
      const sim = cosineSim(currentVec, fp.fingerprintVector)
      if (sim < 0.5) continue

      let count = 0
      for (let j = 0; j < fingerprints.length; j++) {
        if (j === i) continue
        const other = fingerprints[j]!
        if (!other.fingerprintVector || other.fingerprintVector.length === 0) continue
        if (cosineSim(fp.fingerprintVector, other.fingerprintVector) >= 0.85) count++
      }

      rows.push({ row: fp, similarity: sim, recurrenceCount: count })
    }

    rows.sort((a, b) => b.similarity - a.similarity)
    return rows.slice(0, 30)
  }, [fingerprints])

  if (ranked.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-[11px] text-[#62666d]">
        Collecting topology fingerprints...
      </div>
    )
  }

  return (
    <div className="overflow-auto" style={{ maxHeight: 400 }}>
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="border-b border-[rgba(255,255,255,0.05)] text-[10px] font-[590] uppercase tracking-wider text-[#62666d]">
            <th className="px-2 py-1.5">When</th>
            <th className="px-2 py-1.5">Similarity</th>
            <th className="px-2 py-1.5">Class</th>
            <th className="px-2 py-1.5">Winding</th>
            <th className="px-2 py-1.5">&kappa;</th>
            <th className="px-2 py-1.5">D&sup2;</th>
            <th className="px-2 py-1.5">Score</th>
            <th className="px-2 py-1.5">Recurrence</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => {
            const cls = r.row.topologyClass
            const clsColor = CLASS_COLORS[cls] ?? '#8a8f98'
            const simPct = (r.similarity * 100).toFixed(0)
            const barFill = Math.round(r.similarity * 100)

            return (
              <tr
                key={i}
                className="border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.02)]"
              >
                <td className="px-2 py-1.5 font-mono text-[#8a8f98]">
                  {formatTimestamp(r.row.timestamp)}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1 w-12 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${barFill}%`,
                          backgroundColor: r.similarity >= 0.9 ? '#50dd80' : r.similarity >= 0.75 ? '#ffaa33' : '#8a8f98',
                        }}
                      />
                    </div>
                    <span className="font-mono text-[#d0d6e0]">{simPct}%</span>
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className="rounded px-1 py-0.5 font-mono text-[10px]"
                    style={{ backgroundColor: `${clsColor}22`, color: clsColor }}
                  >
                    {cls.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-2 py-1.5 font-mono text-[#d0d6e0]">
                  {r.row.windingNumber.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 font-mono text-[#d0d6e0]">
                  {r.row.kappa.toFixed(1)}
                </td>
                <td className="px-2 py-1.5 font-mono text-[#d0d6e0]">
                  {r.row.corrDim.toFixed(1)}
                </td>
                <td className="px-2 py-1.5 font-mono text-[#d0d6e0]">
                  {(r.row.topologyScore * 100).toFixed(0)}%
                </td>
                <td className="px-2 py-1.5 font-mono text-[#d0d6e0]">
                  {r.recurrenceCount}x
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})
