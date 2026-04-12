import { createFileRoute } from '@tanstack/react-router'
import { GeometryPage } from '@/components/pages/geometry/geometry-page'

export const Route = createFileRoute('/geometry' as any)({
  component: GeometryPage,
})
