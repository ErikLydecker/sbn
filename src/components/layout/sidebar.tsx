import { useRouterState, useRouter } from '@tanstack/react-router'
import {
  LayoutDashboard,
  History,
  BarChart3,
  FlaskConical,
  Settings,
  BrainCircuit,
  Hexagon,
  Orbit,
  Box,
  Shapes,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCallback } from 'react'

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/history', label: 'History', icon: History },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/geometry', label: 'Geometry', icon: Hexagon },
  { to: '/topology', label: 'Topology', icon: Orbit },
  { to: '/shape', label: 'Shape', icon: Shapes },
  { to: '/voxel', label: 'Voxel', icon: Box },
  { to: '/optimization', label: 'Optimization', icon: BrainCircuit },
  { to: '/backtest', label: 'Backtest', icon: FlaskConical },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const routerState = useRouterState()
  const router = useRouter()
  const currentPath = routerState.location.pathname

  const handleNav = useCallback(
    (to: string) => {
      void router.navigate({ to })
    },
    [router],
  )

  return (
    <aside className="flex w-14 flex-col items-center border-r border-[rgba(255,255,255,0.05)] bg-[#0f1011] py-4 gap-1">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary text-[11px] font-[590] text-primary-foreground">
        SB
      </div>
      {NAV_ITEMS.map((item) => {
        const isActive = item.to === '/'
          ? currentPath === '/'
          : currentPath.startsWith(item.to)
        const Icon = item.icon
        return (
          <button
            key={item.to}
            onClick={() => handleNav(item.to)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-[6px] transition-colors',
              isActive
                ? 'bg-[rgba(255,255,255,0.05)] text-[#f7f8f8]'
                : 'text-[#62666d] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#d0d6e0]',
            )}
            title={item.label}
          >
            <Icon className="h-4 w-4" />
          </button>
        )
      })}
    </aside>
  )
}
