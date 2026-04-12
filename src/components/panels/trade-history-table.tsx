import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import { usePortfolioStore } from '@/stores/portfolio.store'
import { REGIME_DEFINITIONS } from '@/schemas/regime'
import type { ClosedTrade } from '@/schemas/trade'
import { cn } from '@/lib/utils'

const columns: ColumnDef<ClosedTrade>[] = [
  {
    accessorKey: 'direction',
    header: 'Dir',
    cell: ({ getValue }) => {
      const dir = getValue<number>()
      return (
        <span className={cn('font-[590]', dir === 1 ? 'text-cycle-rising' : 'text-cycle-falling')}>
          {dir === 1 ? 'LONG' : 'SHORT'}
        </span>
      )
    },
    size: 60,
  },
  {
    accessorKey: 'regimeId',
    header: 'Regime',
    cell: ({ getValue }) => {
      const id = getValue<number>()
      const r = REGIME_DEFINITIONS[id]
      return <span className="text-[#d0d6e0]">{r?.icon} {r?.name}</span>
    },
  },
  {
    accessorKey: 'reason',
    header: 'Exit',
    cell: ({ getValue }) => <span className="text-[#8a8f98]">{getValue<string>()}</span>,
  },
  {
    accessorKey: 'bars',
    header: 'Bars',
    cell: ({ getValue }) => <span className="text-[#8a8f98]">{getValue<number>()}</span>,
  },
  {
    accessorKey: 'returnPct',
    header: 'Return %',
    cell: ({ getValue }) => {
      const v = getValue<number>()
      return (
        <span className={cn('font-[510]', v >= 0 ? 'text-cycle-rising' : 'text-cycle-falling')}>
          {v >= 0 ? '+' : ''}{v.toFixed(2)}%
        </span>
      )
    },
  },
  {
    accessorKey: 'pnl',
    header: 'PnL $',
    cell: ({ getValue }) => {
      const v = getValue<number>()
      return (
        <span className={cn(v >= 0 ? 'text-cycle-rising' : 'text-cycle-falling')}>
          {v >= 0 ? '+' : ''}{v.toFixed(2)}
        </span>
      )
    },
  },
  {
    accessorKey: 'exitPrice',
    header: 'Exit Price',
    cell: ({ getValue }) => <span className="text-[#d0d6e0]">${getValue<number>().toFixed(1)}</span>,
  },
]

export function TradeHistoryTable() {
  const trades = usePortfolioStore((s) => s.trades)
  const [sorting, setSorting] = useState<SortingState>([])

  const reversedTrades = useMemo(() => [...trades].reverse(), [trades])

  const table = useReactTable({
    data: reversedTrades,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  if (trades.length === 0) {
    return <div className="py-8 text-center text-[14px] font-[400] text-[#62666d]">No trades yet.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="cursor-pointer select-none border-b border-[rgba(255,255,255,0.05)] px-2 py-2 text-left text-[10px] font-[510] uppercase tracking-[0.05em] text-[#62666d] hover:text-[#d0d6e0]"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-[rgba(255,255,255,0.05)] last:border-none hover:bg-[rgba(255,255,255,0.02)]">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-2 py-1.5 font-[510]">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
