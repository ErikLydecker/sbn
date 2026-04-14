import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'

const PORT = parseInt(process.env.PORT || '10000', 10)
const DIST = join(import.meta.dirname, 'dist')
const BOOT_TIME = Date.now()
const REQUEST_TIMEOUT_MS = 5_000
const CACHE_TTL_MS = 10_000
const SHUTDOWN_GRACE_MS = 10_000

let shuttingDown = false

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

const BINANCE_WS = 'wss://stream.binance.com:9443/ws'
const BINANCE_REST_ENDPOINTS = [
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api.binance.com',
]

/** Simple in-memory cache for REST proxy responses */
const restCache = new Map()

function getCached(key) {
  const entry = restCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    restCache.delete(key)
    return null
  }
  return entry
}

async function fetchWithFallback(path, search) {
  for (const base of BINANCE_REST_ENDPOINTS) {
    const url = base + path + search
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS)
    try {
      const start = Date.now()
      const r = await fetch(url, {
        headers: { 'User-Agent': 'sbn-proxy' },
        signal: ac.signal,
      })
      clearTimeout(timer)
      const elapsed = Date.now() - start
      if (r.status === 418 || r.status === 451) {
        console.log('[rest] %s → %d (blocked, %dms), trying next', base, r.status, elapsed)
        continue
      }
      console.log('[rest] %s → %d (%dms)', base, r.status, elapsed)
      return r
    } catch (err) {
      clearTimeout(timer)
      const reason = err.name === 'AbortError' ? `timeout (${REQUEST_TIMEOUT_MS}ms)` : err.message
      console.error('[rest] %s → error: %s', base, reason)
      continue
    }
  }
  console.error('[rest] all endpoints failed for %s%s', path, search)
  return null
}

const wss = new WebSocketServer({ noServer: true })

const server = createServer((req, res) => {
  if (shuttingDown) {
    res.writeHead(503, { Connection: 'close' })
    res.end('Shutting down')
    return
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  if (url.pathname === '/health') {
    const payload = {
      status: 'ok',
      uptime: Math.round((Date.now() - BOOT_TIME) / 1000),
      wsClients: wss.clients.size,
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(payload))
    return
  }

  if (url.pathname.startsWith('/api-binance/')) {
    const path = url.pathname.replace('/api-binance', '')
    const cacheKey = path + url.search

    const cached = getCached(cacheKey)
    if (cached) {
      res.writeHead(cached.status, {
        'Content-Type': cached.contentType,
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT',
      })
      res.end(cached.body)
      return
    }

    console.log('[rest] proxying %s%s', path, url.search ? '?' + url.search.slice(1) : '')
    fetchWithFallback(path, url.search)
      .then(async (r) => {
        if (!r) { res.writeHead(502); res.end('All upstreams failed'); return }
        const contentType = r.headers.get('content-type') || 'application/json'
        const body = Buffer.from(await r.arrayBuffer())

        if (r.status === 200) {
          restCache.set(cacheKey, { ts: Date.now(), status: r.status, contentType, body })
        }

        res.writeHead(r.status, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'MISS',
        })
        res.end(body)
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

server.on('upgrade', (req, socket, head) => {
  if (shuttingDown) { socket.destroy(); return }

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
    const upstream = new WebSocket(target)
    let msgCount = 0
    let upstreamReady = false
    const buffered = []

    upstream.on('open', () => {
      console.log('[ws] upstream open')
      upstreamReady = true
      for (const { data, isBinary } of buffered) {
        upstream.send(data, { binary: isBinary })
      }
      buffered.length = 0
    })

    clientWs.on('message', (data, isBinary) => {
      if (upstreamReady && upstream.readyState === WebSocket.OPEN) {
        upstream.send(data, { binary: isBinary })
      } else if (!upstreamReady) {
        buffered.push({ data, isBinary })
      }
    })

    upstream.on('message', (data, isBinary) => {
      msgCount++
      if (msgCount === 1) console.log('[ws] first upstream message received, binary:', isBinary)
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data, { binary: isBinary })
    })

    upstream.on('error', (err) => {
      console.error('[ws] upstream error:', err.message)
      clientWs.close()
    })
    upstream.on('close', (code) => {
      console.log('[ws] upstream closed, code:', code, 'after', msgCount, 'msgs')
      clientWs.close()
    })
    clientWs.on('error', (err) => {
      console.error('[ws] client error:', err.message)
      upstream.close()
    })
    clientWs.on('close', (code) => {
      console.log('[ws] client closed, code:', code)
      upstream.close()
    })
  })
})

server.listen(PORT, () => {
  console.log(`SBN proxy server listening on port ${PORT}`)
})

function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[shutdown] ${signal} received, draining in ${SHUTDOWN_GRACE_MS}ms`)

  for (const client of wss.clients) {
    client.close(1001, 'server shutting down')
  }

  server.close(() => {
    console.log('[shutdown] HTTP server closed')
    process.exit(0)
  })

  setTimeout(() => {
    console.warn('[shutdown] grace period expired, forcing exit')
    process.exit(1)
  }, SHUTDOWN_GRACE_MS).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
