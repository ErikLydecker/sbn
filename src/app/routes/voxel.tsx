import { createFileRoute } from '@tanstack/react-router'
import { VoxelPage } from '@/components/pages/voxel/voxel-page'

export const Route = createFileRoute('/voxel' as any)({
  component: VoxelPage,
})
