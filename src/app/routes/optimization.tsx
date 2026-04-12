import { createFileRoute } from '@tanstack/react-router'
import { OptimizationPage } from '@/components/pages/optimization/optimization-page'

export const Route = createFileRoute('/optimization' as any)({
  component: OptimizationPage,
})
