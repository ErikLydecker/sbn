import { createFileRoute } from '@tanstack/react-router'
import { ShapePage } from '@/components/pages/shape/shape-page'

export const Route = createFileRoute('/shape' as any)({
  component: ShapePage,
})
