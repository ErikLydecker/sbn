import { createFileRoute } from '@tanstack/react-router'
import { BacktestPage } from '@/components/pages/backtest/backtest-page'

export const Route = createFileRoute('/backtest' as any)({
  component: BacktestPage,
})
