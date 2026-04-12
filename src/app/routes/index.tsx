import { createFileRoute } from '@tanstack/react-router'
import { DashboardPage } from '@/components/pages/dashboard/dashboard-page'

export const Route = createFileRoute('/' as any)({
  component: DashboardPage,
})
