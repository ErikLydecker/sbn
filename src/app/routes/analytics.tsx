import { createFileRoute } from '@tanstack/react-router'
import { AnalyticsPage } from '@/components/pages/analytics/analytics-page'

export const Route = createFileRoute('/analytics' as any)({
  component: AnalyticsPage,
})
