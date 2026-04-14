import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'

const PORT = parseInt(process.env.PORT || '10000', 10)
const DIST = join(import.meta.dirname, 'dist')
const START_TIME = Date.now()

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
}

let activeConnections = 0
let totalConnectionsServed = 0

const BINANCE_WS = 'wss://stream.binance.com:9443/ws'
const BINANCE_REST_ENDPOINTS = [
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api.binance.com',
]

async function fetchWithFallback(path, search) {
  for (const base of BINANCE_REST_ENDPOINTS) {
    const url = base + path + search
    try {
      const start = Date.now()
      const r = await fetch(url, { headers: { 'User-Agent': 'sbn-proxy' } })
      const elapsed = Date.now() - start
      if (r.status === 418 || r.status === 451) {
        console.log('[rest] %s → %d (blocked, %dms), trying next', base, r.status, elapsed)
        continue
      }
      console.log('[rest] %s → %d (%dms)', base, r.status, elapsed)
      return r
    } catch (err) {
      console.error('[rest] %s → error: %s', base, err.message)
      continue
    }
  }
  console.error('[rest] all endpoints failed for %s%s', path, search)
  return null
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  if (url.pathname === '/health') {
    const body = JSON.stringify({
      status: 'ok',
      uptimeMs: Date.now() - START_TIME,
      activeConnections,
      totalConnectionsServed,
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(body)
    return
  }

  if (url.pathname.startsWith('/api-binance/')) {
    const path = url.pathname.replace('/api-binance', '')
    console.log('[rest] proxying %s%s', path, url.search ? '?' + url.search.slice(1) : '')
    fetchWithFallback(path, url.search)
      .then(async (r) => {
        if (!r) { res.writeHead(502); res.end('All upstreams failed'); return }
        res.writeHead(r.status, {
          'Content-Type': r.headers.get('content-type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
        })
        const body = await r.arrayBuffer()
        res.end(Buffer.from(body))
      })
      .catch((err) => {
        console.error('[rest] proxy error:', err.message)
        res.writeHead(502)
        res.end('Upstream error')
      })
    return
  }

  let filePath = join(DIST, url.pathname)
  if (!existsSync(filePath) || url.pathname === '/') {
    filePath = join(DIST, 'index.html')
  }

  try {
    const content = readFileSync(filePath)
    const ext = extname(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    })
    res.end(content)
  } catch {
    const fallback = readFileSync(join(DIST, 'index.html'))
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(fallback)
  }
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const url = req.url || ''
  console.log('[ws] upgrade request:', url)

  let stream = ''
  if (url.startsWith('/ws-binance/')) {
    stream = url.replace('/ws-binance/', '')
  } else if (url.startsWith('/ws-binance-alt/')) {
    stream = url.replace('/ws-binance-alt/', '')
  }

  if (!stream) {
    console.log('[ws] no stream match, destroying socket')
    socket.destroy()
    return
  }

  wss.handleUpgrade(req, socket, head, (clientWs) => {
    const target = `${BINANCE_WS}/${stream}`
    console.log('[ws] client connected, opening upstream:', target)

    activeConnections++
    totalConnectionsServed++

    const upstream = new WebSocket(target)
    let msgCount = 0
    let closed = false

    const cleanup = () => {
      if (closed) return
      closed = true
      activeConnections--
    }

    upstream.on('open', () => {
      console.log('[ws] upstream open')
      clientWs.on('message', (data, isBinary) => {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary })
      })
      upstream.on('message', (data, isBinary) => {
        msgCount++
        if (msgCount === 1) console.log('[ws] first upstream message received, binary:', isBinary)
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data, { binary: isBinary })
      })
    })

    upstream.on('error', (err) => {
      console.error('[ws] upstream error:', err.message)
      clientWs.close()
    })
    upstream.on('close', (code) => {
      console.log('[ws] upstream closed, code:', code, 'after', msgCount, 'msgs')
      cleanup()
      clientWs.close()
    })
    clientWs.on('error', (err) => {
      console.error('[ws] client error:', err.message)
      upstream.close()
    })
    clientWs.on('close', (code) => {
      console.log('[ws] client closed, code:', code)
      cleanup()
      upstream.close()
    })
  })
})

server.listen(PORT, () => {
  console.log(`SBN proxy server listening on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[shutdown] SIGTERM received, closing gracefully…')
  wss.clients.forEach((ws) => ws.close(1001, 'server shutting down'))
  server.close(() => {
    console.log('[shutdown] HTTP server closed')
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 5_000)
})
