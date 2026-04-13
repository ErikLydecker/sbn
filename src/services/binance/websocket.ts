export interface WsConnectionOptions {
  url: string
  timeoutMs: number
  onPrice: (price: number) => void
  onOpen: () => void
  onClose: (code: number) => void
  onError: (event: Event) => void
}

export interface WsHandle {
  close: () => void
  lastMessageAt: () => number
}

export function connectBinanceWs(options: WsConnectionOptions): WsHandle {
  const { url, timeoutMs, onPrice, onOpen, onClose, onError } = options
  const ws = new WebSocket(url)
  let _lastMessageAt = 0
  let disposed = false

  const timeout = setTimeout(() => {
    if (!disposed && ws.readyState !== WebSocket.OPEN) {
      ws.close()
    }
  }, timeoutMs)

  ws.addEventListener('open', () => {
    if (disposed) { ws.close(); return }
    clearTimeout(timeout)
    onOpen()
  })

  ws.addEventListener('message', (e: MessageEvent) => {
    if (disposed) return
    _lastMessageAt = Date.now()
    try {
      const data = JSON.parse(e.data as string) as { p?: string }
      const price = parseFloat(data.p ?? '')
      if (price > 0) onPrice(price)
    } catch {
      // skip malformed messages
    }
  })

  ws.addEventListener('error', (e: Event) => {
    if (disposed) return
    clearTimeout(timeout)
    onError(e)
  })

  ws.addEventListener('close', (e: CloseEvent) => {
    if (disposed) return
    clearTimeout(timeout)
    onClose(e.code)
  })

  return {
    close: () => {
      disposed = true
      clearTimeout(timeout)
      if (ws.readyState === WebSocket.OPEN) ws.close()
    },
    lastMessageAt: () => _lastMessageAt,
  }
}
