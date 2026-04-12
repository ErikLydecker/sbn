import type { ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { Providers } from '@/app/providers'
import { useDspWorker } from '@/hooks/use-dsp-worker'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  useDspWorker()

  return (
    <Providers>
      <div className="flex h-screen overflow-hidden bg-[#08090a]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto p-4">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  )
}
