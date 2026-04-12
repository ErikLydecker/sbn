import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'

const PORT = parseInt(process.env.PORT || '10000', 10)
const DIST = join(import.meta.dirname, 'dist')

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
const BINANCE_REST = 'https://api.binance.com'

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  if (url.pathname.startsWith('/api-binance/')) {
    const upstream = BINANCE_REST + url.pathname.replace('/api-binance', '') + url.search
    fetch(upstream, { headers: { 'User-Agent': 'sbn-proxy' } })
      .then(async (r) => {
        res.writeHead(r.status, {
          'Content-Type': r.headers.get('content-type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
        })
        const body = await r.arrayBuffer()
        res.end(Buffer.from(body))
      })
      .catch(() => {
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
    const upstream = new WebSocket(target)
    let msgCount = 0

    upstream.on('open', () => {
      console.log('[ws] upstream open')
      clientWs.on('message', (data) => {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(data)
      })
      upstream.on('message', (data) => {
        msgCount++
        if (msgCount === 1) console.log('[ws] first upstream message received')
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data)
      })
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
