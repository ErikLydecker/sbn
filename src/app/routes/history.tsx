import { createFileRoute } from '@tanstack/react-router'
import { HistoryPage } from '@/components/pages/history/history-page'

export const Route = createFileRoute('/history' as any)({
  component: HistoryPage,
})
