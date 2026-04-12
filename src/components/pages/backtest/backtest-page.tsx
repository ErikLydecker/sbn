import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function BacktestPage() {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Backtest</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-[15px] font-[400] text-[#8a8f98]">
            Historical data replay mode. Connect a data source or load CSV to begin backtesting.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
