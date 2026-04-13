import { createFileRoute } from '@tanstack/react-router'
import { TopologyPage } from '@/components/pages/topology/topology-page'

export const Route = createFileRoute('/topology' as any)({
  component: TopologyPage,
})
