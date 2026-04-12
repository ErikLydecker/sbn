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

  const timeout = setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      ws.close()
    }
  }, timeoutMs)

  ws.onopen = () => {
    clearTimeout(timeout)
    onOpen()
  }

  ws.onmessage = (e: MessageEvent) => {
    _lastMessageAt = Date.now()
    try {
      const data = JSON.parse(e.data as string) as { p?: string }
      const price = parseFloat(data.p ?? '')
      if (price > 0) onPrice(price)
    } catch {
      // skip malformed messages
    }
  }

  ws.onerror = (e: Event) => {
    clearTimeout(timeout)
    onError(e)
  }

  ws.onclose = (e: CloseEvent) => {
    clearTimeout(timeout)
    onClose(e.code)
  }

  return {
    close: () => {
      clearTimeout(timeout)
      ws.close()
    },
    lastMessageAt: () => _lastMessageAt,
  }
}
