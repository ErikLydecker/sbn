import { createFileRoute } from '@tanstack/react-router'
import { MorphologyPage } from '@/components/pages/morphology/morphology-page'

export const Route = createFileRoute('/morphology')({
  component: MorphologyPage,
})
