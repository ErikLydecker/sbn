import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TradeHistoryTable } from '@/components/panels/trade-history-table'

export function HistoryPage() {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          <TradeHistoryTable />
        </CardContent>
      </Card>
    </div>
  )
}
