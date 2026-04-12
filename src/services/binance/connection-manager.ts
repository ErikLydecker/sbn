import { BINANCE_CONFIG } from '@/config/binance'
import { connectBinanceWs } from './websocket'
import type { WsHandle } from './websocket'
import type { ConnectionStatus, ConnectionHealth, ConnectionSource } from '@/schemas/price'

export interface ConnectionManagerCallbacks {
  onPrice: (price: number) => void
  onStatusChange: (status: ConnectionStatus) => void
  onHealthChange: (health: ConnectionHealth) => void
  onGapDetected: (gapMs: number) => void
}

const ENDPOINTS: readonly ConnectionSource[] = ['ws_primary', 'ws_fallback']

function getEndpointUrl(source: ConnectionSource): string {
  return source === 'ws_primary'
    ? BINANCE_CONFIG.ws.primary
    : BINANCE_CONFIG.ws.fallback
}

function computeBackoff(attempt: number): number {
  const { baseDelayMs, maxDelayMs, jitterMs } = BINANCE_CONFIG.retry
  const exponential = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
  const jitter = Math.random() * jitterMs
  return exponential + jitter
}

/**
 * Backoff multiplier for close codes that indicate server-side throttling.
 * 1008 = policy violation (too many connections), 1013 = try again later.
 */
function closeCodeBackoffMultiplier(code: number): number {
  if (code === 1008 || code === 1013) return 3
  return 1
}

export class ConnectionManager {
  private callbacks: ConnectionManagerCallbacks
  private wsHandle: WsHandle | null = null
  private stopped = true
  private attempt = 0
  private endpointIdx = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastDisconnectAt: number | null = null

  private health: ConnectionHealth = {
    connectedSince: null,
    uptimeMs: 0,
    totalReconnects: 0,
    lastMessageAt: null,
    messagesReceived: 0,
    currentSource: null,
    consecutiveFailures: 0,
  }

  private boundOnline = () => this.handleOnline()
  private boundOffline = () => this.handleOffline()

  constructor(callbacks: ConnectionManagerCallbacks) {
    this.callbacks = callbacks
  }

  start(): void {
    this.stopped = false
    window.addEventListener('online', this.boundOnline)
    window.addEventListener('offline', this.boundOffline)
    this.connect()
  }

  stop(): void {
    this.stopped = true
    window.removeEventListener('online', this.boundOnline)
    window.removeEventListener('offline', this.boundOffline)
    this.clearRetryTimer()
    this.stopHeartbeat()
    this.wsHandle?.close()
    this.wsHandle = null
    this.health = { ...this.health, connectedSince: null, uptimeMs: 0, currentSource: null }
    this.emitHealth()
  }

  private get currentSource(): ConnectionSource {
    return ENDPOINTS[this.endpointIdx % ENDPOINTS.length]!
  }

  private connect(): void {
    if (this.stopped) return
    this.clearRetryTimer()

    const source = this.currentSource
    const isReconnect = this.health.totalReconnects > 0 || this.attempt > 0

    this.emitStatus(
      isReconnect
        ? { status: 'reconnecting', source }
        : { status: 'connecting', source },
    )

    this.wsHandle = connectBinanceWs({
      url: getEndpointUrl(source),
      timeoutMs: BINANCE_CONFIG.ws.connectTimeoutMs,
      onPrice: (price) => this.handlePrice(price),
      onOpen: () => this.handleOpen(source),
      onClose: (code) => this.handleClose(code),
      onError: () => {},
    })
  }

  private handleOpen(source: ConnectionSource): void {
    if (this.stopped) return

    const now = Date.now()
    const wasDisconnected = this.lastDisconnectAt !== null

    if (wasDisconnected && this.lastDisconnectAt! > 0) {
      const gapMs = now - this.lastDisconnectAt!
      if (gapMs > 60_000) {
        this.callbacks.onGapDetected(gapMs)
      }
    }

    this.attempt = 0
    this.health = {
      ...this.health,
      connectedSince: now,
      currentSource: source,
      consecutiveFailures: 0,
      totalReconnects: wasDisconnected ? this.health.totalReconnects + 1 : this.health.totalReconnects,
    }

    this.lastDisconnectAt = null
    this.emitHealth()
    this.emitStatus({ status: 'live', source })
    this.startHeartbeat()
  }

  private handlePrice(price: number): void {
    if (this.stopped) return
    this.health = {
      ...this.health,
      lastMessageAt: Date.now(),
      messagesReceived: this.health.messagesReceived + 1,
    }
    this.callbacks.onPrice(price)
  }

  private handleClose(code: number): void {
    if (this.stopped) return

    this.stopHeartbeat()
    this.wsHandle = null
    this.lastDisconnectAt = Date.now()

    this.health = {
      ...this.health,
      connectedSince: null,
      uptimeMs: 0,
      currentSource: null,
      consecutiveFailures: this.health.consecutiveFailures + 1,
    }
    this.emitHealth()

    if (code === 1001) {
      this.endpointIdx++
      this.scheduleRetry(0)
      return
    }

    const multiplier = closeCodeBackoffMultiplier(code)
    this.scheduleRetry(multiplier)
  }

  private scheduleRetry(backoffMultiplier: number): void {
    if (this.stopped) return

    const delay = backoffMultiplier === 0
      ? 0
      : computeBackoff(this.attempt) * backoffMultiplier

    if (delay > 0) {
      this.emitStatus({ status: 'waiting_retry', nextRetryMs: Math.round(delay), attempt: this.attempt + 1 })
    }

    this.attempt++
    this.endpointIdx++

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connect()
    }, delay)
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.stopped || !this.wsHandle) return

      const lastMsg = this.wsHandle.lastMessageAt()
      if (lastMsg === 0) return

      const elapsed = Date.now() - lastMsg
      if (elapsed > BINANCE_CONFIG.ws.staleThresholdMs) {
        this.wsHandle.close()
        this.wsHandle = null
        this.lastDisconnectAt = Date.now()
        this.health = {
          ...this.health,
          connectedSince: null,
          uptimeMs: 0,
          currentSource: null,
          consecutiveFailures: this.health.consecutiveFailures + 1,
        }
        this.emitHealth()
        this.stopHeartbeat()
        this.scheduleRetry(1)
      }
    }, BINANCE_CONFIG.ws.heartbeatIntervalMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private handleOffline(): void {
    if (this.stopped) return

    this.clearRetryTimer()
    this.stopHeartbeat()
    this.wsHandle?.close()
    this.wsHandle = null
    this.lastDisconnectAt = Date.now()

    this.health = {
      ...this.health,
      connectedSince: null,
      uptimeMs: 0,
      currentSource: null,
    }
    this.emitHealth()
    this.emitStatus({ status: 'paused', reason: 'offline' })
  }

  private handleOnline(): void {
    if (this.stopped) return
    this.attempt = 0
    this.connect()
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private emitStatus(status: ConnectionStatus): void {
    if (this.stopped) return
    this.callbacks.onStatusChange(status)
  }

  private emitHealth(): void {
    if (this.stopped) return
    const h = { ...this.health }
    if (h.connectedSince) {
      h.uptimeMs = Date.now() - h.connectedSince
    }
    this.callbacks.onHealthChange(h)
  }
}
