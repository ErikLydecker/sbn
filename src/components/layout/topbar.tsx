import { usePriceStore } from '@/stores/price.store'
import { useConnectionStore } from '@/stores/connection.store'
import { Badge } from '@/components/ui/badge'
import { BINANCE_CONFIG } from '@/config/binance'
import { cn } from '@/lib/utils'
import type { ConnectionStatus } from '@/schemas/price'

export function Topbar() {
  const latestPrice = usePriceStore((s) => s.latestPrice)
  const openPrice = usePriceStore((s) => s.openPrice)
  const status = useConnectionStore((s) => s.status)
  const health = useConnectionStore((s) => s.health)

  const priceChange = openPrice > 0 ? ((latestPrice - openPrice) / openPrice) * 100 : 0
  const isPositive = priceChange >= 0

  const statusLabel = getStatusLabel(status)
  const badgeVariant = getStatusBadgeVariant(status)
  const badgeLabel = getStatusBadgeLabel(status)
  const isLive = status.status === 'live'

  return (
    <header className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] bg-[#0f1011]/80 px-4 py-3 backdrop-blur-sm">
      <div className="flex flex-col gap-0.5">
        <span className="text-[20px] font-[590] tracking-[-0.24px] text-[#f7f8f8]">
          {BINANCE_CONFIG.displayPair}
        </span>
        <div className="flex items-center gap-2 text-[12px] font-[510] text-[#62666d]">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              isLive ? 'bg-[#7170ff] shadow-[0_0_6px_#7170ff]'
                : status.status === 'reconnecting' || status.status === 'waiting_retry' ? 'bg-[#ffb432] shadow-[0_0_6px_rgba(255,180,50,0.4)]'
                : 'bg-[#62666d]',
            )}
          />
          <span>{statusLabel}</span>
          {badgeVariant && badgeLabel && (
            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          )}
          {health.totalReconnects > 0 && isLive && (
            <span className="text-[10px] text-[#62666d]">
              {health.totalReconnects} reconnect{health.totalReconnects !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[24px] font-[510] tracking-[-0.288px] text-[#f7f8f8]">
          {latestPrice > 0 ? formatPrice(latestPrice) : '——'}
        </div>
        <div className={cn('text-[12px] font-[510]', isPositive ? 'text-cycle-rising' : 'text-cycle-falling')}>
          {latestPrice > 0
            ? `${isPositive ? '+' : ''}${priceChange.toFixed(3)}%`
            : '——'}
        </div>
      </div>
    </header>
  )
}

function formatPrice(price: number): string {
  return price >= 1000
    ? price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : price.toFixed(2)
}

function getStatusLabel(status: ConnectionStatus): string {
  switch (status.status) {
    case 'idle': return 'initialising...'
    case 'connecting': return 'connecting...'
    case 'live': return 'binance live'
    case 'reconnecting': return 'reconnecting...'
    case 'waiting_retry': return `retrying in ${Math.ceil(status.nextRetryMs / 1000)}s`
    case 'paused': return 'offline'
    default: return 'unknown'
  }
}

function getStatusBadgeVariant(status: ConnectionStatus): 'live' | 'warning' | 'muted' | null {
  switch (status.status) {
    case 'live': return 'live'
    case 'reconnecting':
    case 'waiting_retry': return 'warning'
    case 'paused': return 'muted'
    default: return null
  }
}

function getStatusBadgeLabel(status: ConnectionStatus): string | null {
  switch (status.status) {
    case 'live': return 'binance live'
    case 'reconnecting': return 'reconnecting'
    case 'waiting_retry': return `attempt ${status.attempt}`
    case 'paused': return 'offline'
    default: return null
  }
}
