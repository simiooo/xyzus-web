#!/usr/bin/env node
/**
 * 独立 Mock HTTP 服务（不依赖 src/alova.ts 的接入，也能让 `pnpm dev` 跑出真实数据）
 *
 * 和 `src/mock/handlers.ts` 共用同一份 fixtures / 分页 / 延时逻辑。
 * 前端 dev server 默认把 `/api/*` 代理到 `http://localhost:23020`，所以最简单的用法：
 *
 *   node scripts/mock-server.mjs                 # 监听 23020，接管代理目标
 *   pnpm dev                                     # 另开一个终端
 *   # 浏览器打开 http://127.0.0.1:5173/?mock=1
 *
 * 如果 23020 被真实的 xyz 后端占了，换一个端口并通过环境变量指过去：
 *
 *   node scripts/mock-server.mjs --port 5188
 *   XYZ_API_TARGET=http://127.0.0.1:5188 pnpm dev
 *
 * 参数：
 *   --port     监听端口（默认 23020）
 *   --host     监听地址（默认 127.0.0.1）
 *   --delay    默认回包延时 ms（默认 600；请求可用 ?delay= 或 body.__delay 覆盖）
 *   --quiet    不打印每个请求
 *
 * 端点：POST /<endpoint> 与 POST /api/<endpoint> 都支持；
 *       GET / 或 GET /health 返回 JSON 端点清单，方便自检。
 */
import http from 'node:http'
import { pathToFileURL } from 'node:url'

const DEFAULT_PORT = 23020
const ENDPOINTS_INFO = [
  'sendCode', 'login', 'refresh_token', 'profile',
  'discovery', 'top_list', 'editor_pick_list_history', 'pilot_discovery_list',
  'podcast_detail', 'episode_list', 'podcast_related', 'podcast_get_info',
  'episode_detail', 'episode_list_by_filter', 'favorite_episode_update', 'favorite_episode_list',
  'private_media_get',
  'search', 'search_preset',
  'comment_primary', 'comment_thread', 'comment_create', 'comment_like_update',
  'comment_remove', 'comment_collect_create', 'comment_collect_remove', 'comment_collect_list',
  'category_list', 'category_list_tab', 'category_podcast_list',
  'subscription', 'subscription_update',
  'pick_list_recent',
]

function parseArgs(argv) {
  const args = { port: DEFAULT_PORT, host: '127.0.0.1', delay: 600, quiet: false }
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]
    if (token === '--port') args.port = Number(argv[++index])
    else if (token === '--host') args.host = argv[++index]
    else if (token === '--delay') args.delay = Number(argv[++index])
    else if (token === '--quiet') args.quiet = true
    else if (token === '--help' || token === '-h') {
      console.log(
        '用法：node scripts/mock-server.mjs [--port 23020] [--host 127.0.0.1] [--delay 600] [--quiet]\n' +
          '端点：POST /<endpoint> 或 POST /api/<endpoint>，GET /health 返回端点清单',
      )
      process.exit(0)
    }
  }
  return args
}

async function loadHandlers() {
  const moduleUrl = new URL('../src/mock/handlers.ts', import.meta.url).href
  return import(moduleUrl)
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-jike-access-token, x-jike-refresh-token',
  'Access-Control-Max-Age': '86400',
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 20_000_000) {
        reject(new Error('请求体过大'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!body.trim()) return resolve({})
      try {
        const parsed = JSON.parse(body)
        resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Content-Length': Buffer.byteLength(body),
    ...CORS_HEADERS,
  })
  res.end(body)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const handlers = await loadHandlers()
  const endpointList = handlers.MOCK_ENDPOINT_LIST ?? ENDPOINTS_INFO
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${args.host}:${args.port}`}`)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS)
      res.end()
      return
    }

    const endpoint = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '').split('/').filter(Boolean).pop() ?? ''

    if (req.method === 'GET' && (!endpoint || endpoint === 'health' || endpoint === 'endpoints')) {
      sendJson(res, 200, {
        ok: true,
        service: 'xyz-web mock server',
        port: args.port,
        delay: args.delay,
        endpoints: endpointList,
        usage: 'POST /<endpoint>（或 POST /api/<endpoint>），body 为 JSON；GET /health 查看清单',
      })
      return
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { code: 40500, msg: `[mock] 只支持 POST：${req.method} ${url.pathname}`, data: null })
      return
    }

    const body = await readBody(req)
    if (!handlers.isMockEndpoint(endpoint)) {
      if (!args.quiet) console.warn(`[mock] 未实现端点：${endpoint}`)
      sendJson(res, 200, {
        code: 40400,
        msg: `[mock] 未实现的端点：${endpoint}（可用端点：${endpointList.join(', ')}）`,
        data: null,
      })
      return
    }

    const delay = handlers.resolveMockDelay(url.toString(), body, args.delay)
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    try {
      const data = handlers.resolveMockResponse(endpoint, body)
      if (!args.quiet) console.log(`[mock] 200 ${endpoint}${delay > 0 ? ` (+${delay}ms)` : ''}`)
      sendJson(res, 200, { code: 0, msg: 'success', data })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!args.quiet) console.error(`[mock] 500 ${endpoint} ${message}`)
      sendJson(res, 200, { code: 50000, msg: message, data: null })
    }
  })

  server.listen(args.port, args.host, () => {
    console.log(`[mock] 已启动 http://${args.host}:${args.port}（delay=${args.delay}ms）`)
    console.log(`[mock] 端点 ${endpointList.length} 个：${endpointList.join(', ')}`)
    console.log('[mock] dev 代理默认指向 23020；换端口请用 XYZ_API_TARGET 启动 pnpm dev')
  })
  const shutdown = () => {
    console.log('[mock] 收到退出信号，正在关闭…')
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 1500).unref()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error(`[mock] 启动失败：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
