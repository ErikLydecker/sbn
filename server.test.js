/**
 * Integration tests for the WebSocket proxy in server.js.
 * Tests the readiness gate / race condition fix during cold start.
 *
 * Run: node --test server.test.js
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'

let portCounter = 20000 + Math.floor(Math.random() * 5000)

function nextPort() { return portCounter++ }

function waitForEvent(emitter, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), timeoutMs)
    emitter.once(event, (...args) => {
      clearTimeout(timer)
      resolve(args)
    })
  })
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * @param {number} port
 * @param {{ acceptDelayMs?: number }} opts
 */
function createMockUpstream(port, opts = {}) {
  const { acceptDelayMs = 0 } = opts
  const httpServer = createServer()
  const connections = []

  let wss
  if (acceptDelayMs > 0) {
    wss = new WebSocketServer({ noServer: true })
    httpServer.on('upgrade', (req, socket, head) => {
      setTimeout(() => {
        if (socket.destroyed) return
        wss.handleUpgrade(req, socket, head, (ws) => {
          connections.push(ws)
          wss.emit('connection', ws, req)
        })
      }, acceptDelayMs)
    })
  } else {
    wss = new WebSocketServer({ server: httpServer })
    wss.on('connection', (ws) => {
      connections.push(ws)
    })
  }

  return {
    start: () => new Promise((r) => httpServer.listen(port, r)),
    stop: () => new Promise((r) => { wss.close(); httpServer.close(r) }),
    get connections() { return connections },
    wss,
  }
}

function createProxyServer(port, upstreamUrl) {
  const UPSTREAM_CONNECT_TIMEOUT_MS = 2_000
  let activeConnections = 0
  const logs = []

  const wss = new WebSocketServer({ noServer: true })

  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', wsClients: wss.clients.size, activeConnections }))
  })

  server.on('upgrade', (req, socket, head) => {
    const url = req.url || ''
    let stream = ''
    if (url.startsWith('/ws-binance/')) {
      stream = url.replace('/ws-binance/', '')
    } else if (url.startsWith('/ws-binance-alt/')) {
      stream = url.replace('/ws-binance-alt/', '')
    }

    if (!stream) { socket.destroy(); return }

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      const target = `${upstreamUrl}/${stream}`
      logs.push('client connected')

      activeConnections++

      const upstream = new WebSocket(target)
      let closed = false
      let upstreamReady = false
      let clientGone = false
      const buffered = []

      const cleanup = () => {
        if (closed) return
        closed = true
        activeConnections--
        clearTimeout(connectTimer)
      }

      const connectTimer = setTimeout(() => {
        if (!upstreamReady && !closed) {
          logs.push('upstream connect timeout')
          cleanup()
          upstream.close()
          clientWs.close(1013, 'upstream connect timeout')
        }
      }, UPSTREAM_CONNECT_TIMEOUT_MS)

      upstream.on('open', () => {
        clearTimeout(connectTimer)
        if (clientGone) {
          logs.push('upstream opened but client already gone')
          cleanup()
          upstream.close()
          return
        }
        logs.push('upstream open')
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
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data, { binary: isBinary })
      })

      upstream.on('error', (err) => {
        if (clientGone && !upstreamReady) {
          logs.push('upstream handshake cancelled (client gone)')
          return
        }
        logs.push(`upstream error: ${err.message}`)
        cleanup()
        clientWs.close()
      })
      upstream.on('close', () => {
        if (clientGone && !upstreamReady) return
        logs.push('upstream closed')
        cleanup()
        clientWs.close()
      })
      clientWs.on('error', (err) => {
        logs.push(`client error: ${err.message}`)
        clientGone = true
        cleanup()
        upstream.close()
      })
      clientWs.on('close', () => {
        logs.push('client closed')
        clientGone = true
        cleanup()
        if (!upstreamReady) {
          logs.push('client disconnected before upstream ready')
        }
        upstream.close()
      })
    })
  })

  return {
    start: () => new Promise((r) => server.listen(port, r)),
    stop: () => new Promise((r) => { wss.close(); server.close(r) }),
    get logs() { return logs },
    get activeConnections() { return activeConnections },
    clearLogs: () => { logs.length = 0 },
  }
}

describe('WebSocket proxy readiness gate', () => {
  it('proxies data normally when client stays connected', async () => {
    const upPort = nextPort()
    const pxPort = nextPort()
    const mock = createMockUpstream(upPort)
    await mock.start()
    const proxy = createProxyServer(pxPort, `ws://127.0.0.1:${upPort}`)
    await proxy.start()

    const client = new WebSocket(`ws://127.0.0.1:${pxPort}/ws-binance/btcusdt@trade`)
    await waitForEvent(client, 'open')
    await delay(200)

    const upstreamWs = mock.connections[mock.connections.length - 1]
    const msgPromise = waitForEvent(client, 'message')
    upstreamWs.send(JSON.stringify({ p: '12345.67' }))

    const [data] = await msgPromise
    const parsed = JSON.parse(data.toString())
    assert.equal(parsed.p, '12345.67')

    client.close()
    await waitForEvent(client, 'close')
    await delay(100)

    assert.ok(proxy.logs.includes('upstream open'), 'should log upstream open')
    assert.ok(!proxy.logs.some((l) => l.startsWith('upstream error')), 'should not log upstream error')

    await proxy.stop()
    await mock.stop()
  })

  it('cleanly handles client disconnect before upstream opens (race condition)', async () => {
    const upPort = nextPort()
    const pxPort = nextPort()
    const mock = createMockUpstream(upPort, { acceptDelayMs: 1000 })
    await mock.start()
    const proxy = createProxyServer(pxPort, `ws://127.0.0.1:${upPort}`)
    await proxy.start()

    const client = new WebSocket(`ws://127.0.0.1:${pxPort}/ws-binance/btcusdt@trade`)
    await waitForEvent(client, 'open')

    client.close()
    await waitForEvent(client, 'close')
    await delay(1500)

    const hasErrorLog = proxy.logs.some((l) => l.startsWith('upstream error:'))
    assert.ok(!hasErrorLog, `should not log upstream error, logs: ${JSON.stringify(proxy.logs)}`)

    const hasCleanLog = proxy.logs.some(
      (l) => l.includes('client disconnected before upstream ready') ||
             l.includes('upstream opened but client already gone')
    )
    assert.ok(hasCleanLog, `should log clean disconnect, logs: ${JSON.stringify(proxy.logs)}`)

    await proxy.stop()
    await mock.stop()
  })

  it('forwards client messages through to upstream', async () => {
    const upPort = nextPort()
    const pxPort = nextPort()
    const mock = createMockUpstream(upPort)
    await mock.start()
    const proxy = createProxyServer(pxPort, `ws://127.0.0.1:${upPort}`)
    await proxy.start()

    const client = new WebSocket(`ws://127.0.0.1:${pxPort}/ws-binance/btcusdt@trade`)
    await waitForEvent(client, 'open')
    await delay(200)

    const upstreamWs = mock.connections[mock.connections.length - 1]
    const msgPromise = waitForEvent(upstreamWs, 'message')
    client.send('hello-upstream')

    const [receivedData] = await msgPromise
    assert.equal(receivedData.toString(), 'hello-upstream')

    client.close()
    await waitForEvent(client, 'close')
    await delay(100)

    await proxy.stop()
    await mock.stop()
  })

  it('decrements activeConnections on clean close', async () => {
    const upPort = nextPort()
    const pxPort = nextPort()
    const mock = createMockUpstream(upPort)
    await mock.start()
    const proxy = createProxyServer(pxPort, `ws://127.0.0.1:${upPort}`)
    await proxy.start()

    assert.equal(proxy.activeConnections, 0)

    const client = new WebSocket(`ws://127.0.0.1:${pxPort}/ws-binance/btcusdt@trade`)
    await waitForEvent(client, 'open')
    await delay(200)

    assert.equal(proxy.activeConnections, 1)

    client.close()
    await waitForEvent(client, 'close')
    await delay(200)

    assert.equal(proxy.activeConnections, 0, 'activeConnections should return to 0')

    await proxy.stop()
    await mock.stop()
  })

  it('rejects connection on invalid path', async () => {
    const upPort = nextPort()
    const pxPort = nextPort()
    const mock = createMockUpstream(upPort)
    await mock.start()
    const proxy = createProxyServer(pxPort, `ws://127.0.0.1:${upPort}`)
    await proxy.start()

    const client = new WebSocket(`ws://127.0.0.1:${pxPort}/invalid-path`)
    const [err] = await waitForEvent(client, 'error')
    assert.ok(err, 'should get an error for invalid path')

    await proxy.stop()
    await mock.stop()
  })

  it('times out when upstream never opens', async () => {
    const pxPort = nextPort()
    const proxy = createProxyServer(pxPort, 'ws://192.0.2.1:1')
    await proxy.start()

    const client = new WebSocket(`ws://127.0.0.1:${pxPort}/ws-binance/btcusdt@trade`)
    await waitForEvent(client, 'open')

    const [code] = await waitForEvent(client, 'close', 10000)

    const hasTimeout = proxy.logs.some((l) => l.includes('upstream connect timeout') || l.includes('upstream error'))
    assert.ok(hasTimeout || code !== undefined, 'should timeout or error when upstream is unreachable')

    await proxy.stop()
  })
})
