import { createFileRoute } from '@tanstack/react-router'
import { ReadinessPage } from '@/components/pages/readiness/readiness-page'

export const Route = createFileRoute('/readiness' as any)({
  component: ReadinessPage,
})
