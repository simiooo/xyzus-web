#!/usr/bin/env node
/**
 * 无头浏览器截图工具（零依赖，直接调用本机 Chrome 的 CDP）
 *
 * 这是全队视觉验收的唯一截图实现。`scripts/cdp-shot.mjs` 是它的兼容外壳（
 * 保留 Lead 最初的 --budget 等参数），不要另写第二套 CDP 截图逻辑。
 *
 * 用法：
 *   node scripts/shot.mjs --url http://127.0.0.1:5173/ --out shots/home.png
 *   node scripts/shot.mjs --url http://127.0.0.1:5173/search --out shots/search.png --full
 *   node scripts/shot.mjs --url http://127.0.0.1:5173/ --out shots/home-mobile.png --mobile
 *   node scripts/shot.mjs --url http://127.0.0.1:5173/login --out shots/login.png --no-auth
 *
 * 关键实现（踩过的坑都写在这）：
 * 1. Chrome 的 --user-data-dir 固定放在系统临时目录（os.tmpdir()/chrome-xyz-shot），
 *    绝不放工作区 —— 否则 Vite 的文件监听器读到 Chrome 锁文件会 EBUSY 崩掉 dev server。
 *    每次运行前清空这个临时 profile（避免上一轮残留的 localStorage / 锁）。
 * 2. 桌面/移动尺寸一律走 CDP Emulation.setDeviceMetricsOverride，不用 --window-size：
 *    Windows 上 Chrome 窗口有 ~500px 最小宽度，--window-size=390 会被裁成假溢出。
 *    移动端默认 390×844 + deviceScaleFactor=2 + mobile=true + iPhone UA，
 *    因此 PNG 实际像素是 780×1688（CSS 视口正好 390×844）；要精确 390×844 用 --scale 1。
 * 3. 退出前 try/finally 杀 Chrome 进程树（Windows 用 taskkill /T /F），不残留进程。
 * 4. 连不上 dev server 时打印明确中文提示（「dev server 未启动，先跑 pnpm dev」）。
 * 5. 内置 API mock 拦截（CDP Fetch 域）：直接拦截 `/api/*` 请求并用
 *    src/mock/handlers.ts 的 fixtures 回包，因此即使 src/alova.ts 还没接
 *    VITE_API_MOCK，截图也能看到完整 mock 数据（等接入后这个拦截就是冗余保险）。
 *    用 --no-api-mock 关闭。
 *
 * 参数（详见 `node scripts/shot.mjs --help`）：
 *   --url          目标地址（必填）
 *   --out          输出 PNG（默认 shots/<路由>-<尺寸>.png）
 *   --width --height 视口尺寸（桌面默认 1440×900）
 *   --mobile       390×844 移动端模拟（CDP device metrics，不是 window-size）
 *   --scale        设备像素比（默认桌面 1 / 移动 2）
 *   --full         整页截图（captureBeyondViewport + cssContentSize）
 *   --wait         页面加载完成后再固定等待的毫秒数（默认 1000，自定义等待）
 *   --idle         网络空闲判定窗口（默认 800ms）
 *   --timeout      单页最长等待（默认 30000ms；超时仍会尽量截一张）
 *   --auth/--no-auth   是否预置 mock 登录 token（默认预置）
 *   --mock/--no-mock   是否在 localStorage/window 打开 mock 开关（默认打开）
 *   --api-mock/--no-api-mock  是否用 CDP 拦截 /api/* 返回 fixtures（默认打开）
 *   --api-delay    API 回包延时（默认 0，截图求快；调大可看骨架屏）
 *   --token       access token（配合 --refresh-token 覆盖默认 mock token）
 *   --chrome      指定 Chrome 可执行文件
 *   --json        只输出 JSON
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// ---------------------------------------------------------------------------
// 常量 & 小工具
// ---------------------------------------------------------------------------

export const DEFAULT_DESKTOP = { width: 1440, height: 900 }
export const DEFAULT_MOBILE = { width: 390, height: 844 }

const DEFAULT_AUTH_TOKENS = {
  'x-jike-access-token': 'mock-access-token',
  'x-jike-refresh-token': 'mock-refresh-token',
}

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 固定复用系统临时目录下的 profile（绝不在工作区里） */
function profileDirectory() {
  return path.join(os.tmpdir(), 'chrome-xyz-shot-' + process.pid + '-' + Date.now())
}

/**
 * 清理系统临时目录里过期的截图 profile（>30 分钟且不是当前进程的）。
 * 每个进程用唯一目录，避免两个截图进程共用 profile 导致 Chrome 互杀。
 */
async function cleanupStaleProfiles(baseDir) {
  try {
    const entries = await fsp.readdir(baseDir, { withFileTypes: true })
    const now = Date.now()
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (!entry.name.startsWith('chrome-xyz-shot-')) continue
      const dir = path.join(baseDir, entry.name)
      if (dir === baseDir) continue
      try {
        const stat = await fsp.stat(dir)
        if (now - stat.mtimeMs > 30 * 60 * 1000) {
          await fsp.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
    : null,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

export function resolveChromePath(explicit) {
  const candidates = explicit ? [explicit, ...CHROME_CANDIDATES] : CHROME_CANDIDATES
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }
  throw new Error(
    '找不到 Chrome/Edge。请用 --chrome "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" 指定，' +
      '或设置环境变量 CHROME_PATH。',
  )
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** 读取 PNG 像素尺寸（IHDR） */
function readPngSize(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 12, 16) !== 'IHDR') return null
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

export function slugForUrl(url) {
  try {
    const parsed = new URL(url, 'http://localhost')
    const route = parsed.pathname.replace(/\/+$/, '')
    if (!route || route === '/') return 'home'
    return (
      route
        .split('/')
        .filter(Boolean)
        .map((part) => {
          try {
            return decodeURIComponent(part)
          } catch {
            return part
          }
        })
        .join('-')
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .toLowerCase() || 'shot'
    )
  } catch {
    return 'shot'
  }
}

function httpGetJson(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = http.get(
      { host: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, timeout: timeoutMs },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(body))
          } catch (error) {
            reject(new Error(`响应不是 JSON：${String(error)}`))
          }
        })
      },
    )
    req.on('timeout', () => req.destroy(new Error('请求超时')))
    req.on('error', reject)
  })
}

async function findFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

// ---------------------------------------------------------------------------
// 内置 API mock：CDP Fetch 域拦截 /api/*
// ---------------------------------------------------------------------------

let handlersModulePromise = null

async function loadMockHandlers() {
  if (!handlersModulePromise) {
    const moduleUrl = new URL('../src/mock/handlers.ts', import.meta.url).href
    handlersModulePromise = import(moduleUrl)
  }
  return handlersModulePromise
}

function base64Encode(text) {
  return Buffer.from(text, 'utf8').toString('base64')
}

function apiResponseHeaders(extra = {}) {
  return [
    { name: 'Content-Type', value: 'application/json; charset=UTF-8' },
    { name: 'Cache-Control', value: 'no-store' },
    { name: 'Access-Control-Allow-Origin', value: '*' },
    ...Object.entries(extra).map(([name, value]) => ({ name, value: String(value) })),
  ]
}

async function handleInterceptedApiRequest(cdp, params, options, stats) {
  const { requestId, request } = params
  const method = request.method || 'GET'
  const rawUrl = request.url || ''
  let pathname = rawUrl
  try {
    pathname = new URL(rawUrl).pathname
  } catch {
    // relative
  }
  if (method === 'OPTIONS') {
    await cdp.request('Fetch.fulfillRequest', {
      requestId,
      responseCode: 204,
      responseHeaders: apiResponseHeaders(),
      body: '',
    })
    return
  }
  if (!pathname.includes('/api/')) {
    await cdp.request('Fetch.continueRequest', { requestId })
    return
  }
  let endpoint = pathname.replace(/\/+$/, '').split('/').pop() || ''
  let body = {}
  if (request.postData) {
    try {
      const parsed = JSON.parse(request.postData)
      body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      body = {}
    }
  }
  const delay = Number.isFinite(options.apiDelay) ? options.apiDelay : 0
  try {
    const handlers = await loadMockHandlers()
    if (!handlers.isMockEndpoint(endpoint)) {
      stats.unknown.push(endpoint)
      const payload = JSON.stringify({
        code: 40400,
        msg: `[mock] 未实现的端点：${endpoint}（可用端点见 src/mock/handlers.ts）`,
        data: null,
      })
      await cdp.request('Fetch.fulfillRequest', {
        requestId,
        responseCode: 404,
        responseHeaders: apiResponseHeaders(),
        body: base64Encode(payload),
      })
      return
    }
    if (delay > 0) await sleep(delay)
    const data = handlers.resolveMockResponse(endpoint, body)
    stats.ok.push(endpoint)
    const payload = JSON.stringify({ code: 0, msg: 'success', data })
    await cdp.request('Fetch.fulfillRequest', {
      requestId,
      responseCode: 200,
      responseHeaders: apiResponseHeaders(),
      body: base64Encode(payload),
    })
  } catch (error) {
    stats.failed.push(endpoint)
    const message = error instanceof Error ? error.message : String(error)
    const payload = JSON.stringify({ code: 50000, msg: message, data: null })
    try {
      await cdp.request('Fetch.fulfillRequest', {
        requestId,
        responseCode: 500,
        responseHeaders: apiResponseHeaders(),
        body: base64Encode(payload),
      })
    } catch {
      // request 可能已取消
    }
  }
}

// ---------------------------------------------------------------------------
// CDP 最小客户端（Node 24 内置 WebSocket）
// ---------------------------------------------------------------------------

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
    this.closed = false
  }

  async connect(timeoutMs = 10000) {
    if (typeof WebSocket !== 'function') {
      throw new Error('当前 Node 没有内置 WebSocket（需要 Node ≥ 22），请升级 Node。')
    }
    const ws = new WebSocket(this.wsUrl)
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`CDP WebSocket 连接超时：${this.wsUrl}`)), timeoutMs)
      ws.addEventListener('open', () => {
        clearTimeout(timer)
        resolve()
      }, { once: true })
      ws.addEventListener('error', () => {
        clearTimeout(timer)
        reject(new Error(`CDP WebSocket 连接失败：${this.wsUrl}`))
      }, { once: true })
    })
    this.ws = ws
    ws.addEventListener('message', (event) => this.#handleMessage(event))
    ws.addEventListener('close', () => {
      this.closed = true
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer)
        reject(new Error('CDP 连接已关闭'))
      }
      this.pending.clear()
    })
    return this
  }

  #handleMessage(event) {
    let message
    try {
      message = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data))
    } catch {
      return
    }
    if (message.id && this.pending.has(message.id)) {
      const entry = this.pending.get(message.id)
      this.pending.delete(message.id)
      clearTimeout(entry.timer)
      if (message.error) entry.reject(new Error(`${message.error.message} (${message.error.code})`))
      else entry.resolve(message.result)
      return
    }
    if (message.method) {
      const handlers = this.listeners.get(message.method)
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(message.params)
          } catch {
            // 监听器异常不影响主流程
          }
        }
      }
    }
  }

  on(method, handler) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set())
    this.listeners.get(method).add(handler)
    return () => {
      this.listeners.get(method)?.delete(handler)
    }
  }

  request(method, params = {}, timeoutMs = 30000) {
    if (this.closed || !this.ws) return Promise.reject(new Error('CDP 连接已关闭'))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP 请求超时：${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      try {
        this.ws.send(JSON.stringify({ id, method, params }))
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  close() {
    this.closed = true
    try {
      this.ws?.close()
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Chrome 生命周期
// ---------------------------------------------------------------------------

function chromeLaunchArgs({ port, profileDir, headful }) {
  const args = [
    headful ? '--start-normal-mode' : '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-features=Translate,MediaRouter,OptimizationHints',
    '--disable-dev-shm-usage',
    '--metrics-recording-only',
    '--mute-audio',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ]
  if (headful) args.splice(1, 1)
  return args.filter((arg) => arg !== '--start-normal-mode')
}

async function waitForDevtools(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      return await httpGetJson(`http://127.0.0.1:${port}/json/version`, 1500)
    } catch (error) {
      lastError = error
      await sleep(150)
    }
  }
  throw new Error(
    `Chrome 没有在 ${timeoutMs}ms 内打开 DevTools 端口（127.0.0.1:${port}）：` +
      `${lastError instanceof Error ? lastError.message : String(lastError)}`,
  )
}

async function findPageTargetWebSocket(port, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const targets = await httpGetJson(`http://127.0.0.1:${port}/json/list`, 1500)
      if (Array.isArray(targets)) {
        const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl)
        if (page) return page.webSocketDebuggerUrl
      }
    } catch (error) {
      lastError = error
    }
    await sleep(150)
  }
  throw new Error(
    `找不到 Chrome 的页面 target：${lastError instanceof Error ? lastError.message : '未知错误'}`,
  )
}

async function killChrome(child) {
  if (!child || child.exitCode !== null || child.killed) return
  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    } catch {
      // ignore
    }
  } else {
    try {
      child.kill('SIGTERM')
    } catch {
      // ignore
    }
  }
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve()
    const timer = setTimeout(resolve, 3000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
  if (child.exitCode === null) {
    try {
      child.kill('SIGKILL')
    } catch {
      // ignore
    }
  }
}

function killChromeProcessesByProfile(profileDir) {
  if (process.platform !== 'win32') return
  const marker = path.basename(profileDir)
  if (!marker) return
  const script = `Get-CimInstance Win32_Process -Filter "name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${marker}*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }`
  try {
    spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: 'ignore',
      windowsHide: true,
      timeout: 8000,
    })
  } catch {
    // ignore
  }
}

async function cleanDirectory(dir) {
  try {
    await fsp.rm(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 120 })
  } catch {
    // 删不掉就沿用旧目录
  }
  await fsp.mkdir(dir, { recursive: true })
}

/** 启动 Chrome 并连上页面 target。返回 ChromeBrowser。 */
export async function launchChrome(options = {}) {
  const {
    chromePath,
    headful = false,
    keepProfile = false,
    quiet = false,
    apiMock = true,
    apiDelay = 0,
  } = options
  const chrome = resolveChromePath(chromePath)
  const profileDir = profileDirectory()
  void cleanupStaleProfiles(os.tmpdir())
  if (!keepProfile) await cleanDirectory(profileDir)
  else await fsp.mkdir(profileDir, { recursive: true })
  const port = await findFreePort()
  const args = chromeLaunchArgs({ port, profileDir, headful })
  const child = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let stderr = ''
  child.stderr?.on('data', (chunk) => {
    stderr += String(chunk)
    if (stderr.length > 24_000) stderr = stderr.slice(-24_000)
  })
  try {
    await waitForDevtools(port)
    const pageWebSocket = await findPageTargetWebSocket(port)
    const cdp = await new CdpClient(pageWebSocket).connect()
    await cdp.request('Page.enable')
    await cdp.request('Runtime.enable')
    await cdp.request('Network.enable')
    await cdp.request('Log.enable').catch(() => {})
    const browser = new ChromeBrowser({
      child, cdp, chromePath: chrome, profileDir, port, keepProfile, quiet,
      apiMock, apiDelay,
    })
    if (apiMock) await browser.enableApiMock()
    if (!quiet) console.log(`[shot] Chrome ${headful ? 'headed' : 'headless'} 已启动 (CDP 127.0.0.1:${port})`)
    return browser
  } catch (error) {
    await killChrome(child)
    const detail = stderr.trim().split('\n').slice(-6).join('\n')
    throw new Error(
      `Chrome 启动失败：${error instanceof Error ? error.message : String(error)}` +
        (detail ? `\n--- Chrome stderr ---\n${detail}` : ''),
    )
  }
}

class ChromeBrowser {
  constructor({ child, cdp, chromePath, profileDir, port, keepProfile, quiet, apiMock, apiDelay }) {
    this.child = child
    this.cdp = cdp
    this.chromePath = chromePath
    this.profileDir = profileDir
    this.port = port
    this.keepProfile = keepProfile
    this.quiet = quiet
    this.apiMock = apiMock
    this.apiDelay = apiDelay
    this.seedScriptId = null
    this.closed = false
    this.apiMockEnabled = false
    this.apiStats = { ok: [], unknown: [], failed: [] }
  }

  async enableApiMock() {
    if (this.apiMockEnabled) return
    this.cdp.on('Fetch.requestPaused', (params) => {
      handleInterceptedApiRequest(this.cdp, params, { apiDelay: this.apiDelay }, this.apiStats).catch(
        () => {},
      )
    })
    this.apiMockEnabled = true
    if (!this.quiet) console.log('[shot] 已开启 API mock 拦截（CDP Fetch → src/mock/handlers.ts）')
  }

  /** 每次截图前按目标 origin 精确设置拦截规则：只拦 <origin>/api/*，不误伤 /src/api/*.ts 源码模块 */
  async #configureApiMock(url) {
    if (!this.apiMockEnabled) return
    let origin = ''
    try {
      origin = new URL(url).origin
    } catch {
      origin = ''
    }
    if (!origin) return
    await this.cdp.request('Fetch.disable').catch(() => {})
    await this.cdp.request('Fetch.enable', {
      patterns: [{ urlPattern: origin + '/api/*', requestStage: 'Request' }],
      handleAuthRequests: false,
    })
  }

  /** 用「新文档注入脚本」预置 mock token / mock 开关；每次截图前替换，保证 --no-auth 生效 */
  async #applySeedScript({ auth, mock, accessToken, refreshToken }) {
    if (this.seedScriptId) {
      try {
        await this.cdp.request('Page.removeScriptToEvaluateOnNewDocument', { identifier: this.seedScriptId })
      } catch {
        // ignore
      }
      this.seedScriptId = null
    }
    const access = accessToken || DEFAULT_AUTH_TOKENS['x-jike-access-token']
    const refresh = refreshToken || DEFAULT_AUTH_TOKENS['x-jike-refresh-token']
    const tokenLines = auth
      ? `localStorage.setItem('x-jike-access-token', ${JSON.stringify(access)});` +
        `localStorage.setItem('x-jike-refresh-token', ${JSON.stringify(refresh)});`
      : `localStorage.removeItem('x-jike-access-token');` +
        `localStorage.removeItem('x-jike-refresh-token');` +
        `localStorage.removeItem('x-jike-user-profile');`
    const mockLines = mock
      ? `localStorage.setItem('xyz-mock', 'on');window.__XYZ_MOCK__ = true;`
      : `localStorage.setItem('xyz-mock', 'off');window.__XYZ_MOCK__ = false;`
    const source = `try {\n${tokenLines}\n${mockLines}\n} catch (e) { /* ignore */ }`
    const result = await this.cdp.request('Page.addScriptToEvaluateOnNewDocument', {
      source,
      runImmediately: false,
    })
    this.seedScriptId = result?.identifier ?? null
  }

  async capture(options = {}) {
    const cdp = this.cdp
    const url = options.url
    if (!url) throw new Error('缺少 url')
    const mobile = Boolean(options.mobile)
    const width = Number(options.width) || (mobile ? DEFAULT_MOBILE.width : DEFAULT_DESKTOP.width)
    const height = Number(options.height) || (mobile ? DEFAULT_MOBILE.height : DEFAULT_DESKTOP.height)
    const defaultScale = mobile ? 2 : 1
    const scale = Number(options.scale) > 0 ? Number(options.scale) : defaultScale
    const full = Boolean(options.full)
    const waitMs = Number.isFinite(Number(options.wait)) ? Number(options.wait) : 1000
    const idleMs = Number.isFinite(Number(options.idle)) ? Number(options.idle) : 800
    const timeoutMs = Number.isFinite(Number(options.timeout)) ? Number(options.timeout) : 30_000
    const auth = options.auth !== false
    const mock = options.mock !== false
    const quiet = Boolean(options.quiet ?? this.quiet)
    const outPath = options.out
      ? path.resolve(options.out)
      : path.resolve('shots', `${slugForUrl(url)}${mobile ? '-mobile' : ''}.png`)

    await this.#applySeedScript({
      auth,
      mock,
      accessToken: options.accessToken,
      refreshToken: options.refreshToken,
    })
    await this.#configureApiMock(url)

    // 关键：用 CDP device metrics 模拟，不用 --window-size（Windows 最小窗口宽度会裁切）
    await cdp.request('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: scale,
      mobile,
      screenWidth: width,
      screenHeight: height,
      screenOrientation: mobile
        ? { type: 'portraitPrimary', angle: 0 }
        : { type: 'landscapePrimary', angle: 90 },
    })
    if (mobile) {
      await cdp.request('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
      await cdp.request('Emulation.setUserAgentOverride', { userAgent: IPHONE_UA, platform: 'iPhone' })
    } else {
      await cdp.request('Emulation.setTouchEmulationEnabled', { enabled: false })
      await cdp.request('Emulation.setUserAgentOverride', { userAgent: '' })
    }

    const pendingRequests = new Set()
    let loadFired = false
    let lastNetworkActivity = Date.now()
    const exceptions = []

    const offHandlers = [
      cdp.on('Page.loadEventFired', () => {
        loadFired = true
        lastNetworkActivity = Date.now()
      }),
      cdp.on('Network.requestWillBeSent', (params) => {
        if (!params?.request?.url) return
        const requestUrl = params.request.url
        if (/^(ws|wss|data|blob|chrome-extension|devtools):/.test(requestUrl)) return
        if (!params.redirectResponse) pendingRequests.add(params.requestId)
        lastNetworkActivity = Date.now()
      }),
      cdp.on('Network.loadingFinished', (params) => {
        pendingRequests.delete(params?.requestId)
        lastNetworkActivity = Date.now()
      }),
      cdp.on('Network.loadingFailed', (params) => {
        pendingRequests.delete(params?.requestId)
        lastNetworkActivity = Date.now()
      }),
      cdp.on('Runtime.consoleAPICalled', (params) => {
        if (params?.type !== 'error' && params?.type !== 'warning') return
        const text = (params.args ?? [])
          .map((arg) => arg?.value ?? arg?.description ?? arg?.type ?? '')
          .join(' ')
        if (text && exceptions.length < 10) exceptions.push('[console.' + params.type + '] ' + String(text).slice(0, 320))
      }),
      cdp.on('Log.entryAdded', (params) => {
        const entry = params?.entry
        if (!entry || entry.level !== 'error') return
        if (exceptions.length < 10) exceptions.push('[log] ' + String(entry.text ?? '').slice(0, 320))
      }),
      cdp.on('Runtime.exceptionThrown', (params) => {
        const description =
          params?.exceptionDetails?.exception?.description ||
          params?.exceptionDetails?.text ||
          '未知异常'
        if (exceptions.length < 5) exceptions.push(description.split('\n')[0])
      }),
    ]

    try {
      await cdp.request('Page.navigate', { url }, 20000)
    } catch (error) {
      for (const off of offHandlers) off()
      throw new Error(`页面打开失败（${url}）：${error instanceof Error ? error.message : String(error)}`)
    }

    const networkDeadline = Date.now() + timeoutMs
    let timedOut = false
    let networkSettled = false
    while (Date.now() < networkDeadline) {
      if (loadFired && pendingRequests.size === 0 && Date.now() - lastNetworkActivity >= idleMs) {
        networkSettled = true
        break
      }
      await sleep(60)
    }
    if (!loadFired || pendingRequests.size > 0) timedOut = true

    const debugExpression =
      "(function(){try{var r=document.querySelector('#root');return JSON.stringify({ready:document.readyState,href:location.href,innerW:window.innerWidth,rootChildren:r?r.childElementCount:-1,rootHtml:r?r.innerHTML.slice(0,400):'',bodyText:(document.body&&document.body.innerText||'').slice(0,300),scripts:Array.prototype.map.call(document.scripts,function(s){return s.src}).filter(Boolean).slice(-6)})}catch(e){return 'debug-failed:'+e.message}})()"
    let pageDebug = null
    if (!networkSettled || options.debug) {
      try {
        const info = await cdp.request(
          'Runtime.evaluate',
          { expression: debugExpression, returnByValue: true },
          5000,
        )
        pageDebug = info && info.result ? info.result.value : null
      } catch {
        pageDebug = 'debug-evaluate-failed'
      }
      if (!quiet && (!networkSettled || options.debug)) {
        console.warn('[shot] 页面调试信息：', pageDebug)
      }
    }

    // 等 React 真正渲染出内容（独立于网络等待，避免白屏被截进去）
    const contentDeadline = Date.now() + 15_000
    let hasContent = false
    while (Date.now() < contentDeadline) {
      try {
        const evaluated = await cdp.request(
          'Runtime.evaluate',
          {
            expression:
              "(function(){var r=document.querySelector('#root');return r && r.childElementCount>0 ? (document.body?document.body.innerText.trim().length:1) : 0})()",
            returnByValue: true,
          },
          5000,
        )
        const value = evaluated?.result?.value
        if (typeof value === 'number' && value > 0) {
          hasContent = true
          break
        }
      } catch {
        // 页面可能正在重载
      }
      await sleep(120)
    }
    if (!hasContent) {
      timedOut = true
      if (!pageDebug) {
        try {
          const info = await cdp.request(
            'Runtime.evaluate',
            { expression: debugExpression, returnByValue: true },
            5000,
          )
          pageDebug = info && info.result ? info.result.value : null
        } catch {
          pageDebug = 'debug-evaluate-failed'
        }
      }
      if (!quiet) console.warn('[shot] 页面内容为空，调试信息：', pageDebug)
    }

    if (waitMs > 0) await sleep(waitMs)

    // 横向溢出检测（Lead 要求的常见布局 bug 检查）
    let layout = null
    try {
      const overflow = await cdp.request('Runtime.evaluate', {
        expression:
          'JSON.stringify({innerW:window.innerWidth,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight})',
        returnByValue: true,
      })
      if (overflow?.result?.value) layout = JSON.parse(overflow.result.value)
    } catch {
      // ignore
    }

    // Vite 错误遮罩检测（src 被改坏时截图全糊的第一线索）
    try {
      const overlay = await cdp.request('Runtime.evaluate', {
        expression:
          "(function(){var o=document.getElementById('vite-error-overlay');return o?o.textContent.slice(0,300):''})()",
        returnByValue: true,
      })
      if (overlay?.result?.value) exceptions.push(`Vite error overlay: ${overlay.result.value}`)
    } catch {
      // ignore
    }

    for (const off of offHandlers) off()

    const screenshotParams = { format: 'png', fromSurface: true, captureBeyondViewport: full }
    if (full) {
      const metrics = await cdp.request('Page.getLayoutMetrics')
      const cssSize = metrics?.cssContentSize ?? metrics?.contentSize
      if (cssSize && Number.isFinite(cssSize.width) && Number.isFinite(cssSize.height)) {
        screenshotParams.clip = {
          x: 0,
          y: 0,
          width: Math.max(1, Math.ceil(cssSize.width)),
          height: Math.max(1, Math.ceil(cssSize.height)),
          scale: 1,
        }
      }
    }
    const shot = await cdp.request('Page.captureScreenshot', screenshotParams, 30000)
    const buffer = Buffer.from(shot.data, 'base64')
    await fsp.mkdir(path.dirname(outPath), { recursive: true })
    await fsp.writeFile(outPath, buffer)
    const pngSize = readPngSize(buffer)
    const overflowPx = layout ? layout.scrollW - layout.innerW : null

    const result = {
      url,
      out: outPath,
      width,
      height,
      scale,
      mobile,
      full,
      pngWidth: pngSize?.width ?? null,
      pngHeight: pngSize?.height ?? null,
      bytes: buffer.length,
      timedOut,
      exceptions,
      layout,
      horizontalOverflow: overflowPx !== null && overflowPx > 0 ? overflowPx : 0,
      pageDebug,
    }
    if (!quiet) {
      const sizeText = pngSize ? `${pngSize.width}x${pngSize.height}` : `${buffer.length} bytes`
      const warn = timedOut ? '（等待超时，仍已截图）' : ''
      console.log(`✓ ${outPath}  ${sizeText}  ${formatBytes(buffer.length)}${warn}`)
      if (layout) {
        console.log(
          `  viewport=${layout.innerW} scrollWidth=${layout.scrollW} scrollHeight=${layout.scrollH}` +
            ` 横向溢出=${overflowPx > 0 ? `${overflowPx}px` : '无'}`,
        )
      }
      if (exceptions.length > 0) {
        console.warn(`  页面异常 ${exceptions.length} 条：`)
        for (const exception of exceptions) console.warn('   - ' + exception)
      }
    }
    return result
  }

  async close() {
    if (this.closed) return
    this.closed = true
    try {
      this.cdp.close()
    } catch {
      // ignore
    }
    await killChrome(this.child)
    killChromeProcessesByProfile(this.profileDir)
    await sleep(150)
    if (!this.keepProfile) {
      try {
        await fsp.rm(this.profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 120 })
      } catch {
        // 系统临时目录，删不掉不影响工作区
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 高层 API（shoot-all.mjs 复用）
// ---------------------------------------------------------------------------

/** 检查 dev server 是否已启动；连不上时抛出带中文提示的错误 */
export async function assertServerReachable(url, timeoutMs = 5000) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return { skipped: true }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { skipped: true }
  const origin = `${parsed.protocol}//${parsed.host}`
  try {
    const response = await fetch(`${origin}/`, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) })
    return { skipped: false, origin, status: response.status }
  } catch (error) {
    const cause = error && error.cause && error.cause.code ? `（${error.cause.code}）` : ''
    throw new Error(
      `dev server 未启动：无法连接 ${origin}${cause}。先运行 pnpm dev（或 node scripts/mock-server.mjs 后用 pnpm dev），再截图。`,
    )
  }
}

/** 截图一次（自动启动 / 关闭 Chrome） */
export async function takeScreenshot(options = {}) {
  if (!options.skipServerCheck && options.url) await assertServerReachable(options.url)
  const browser = await launchChrome(options)
  try {
    return await browser.capture(options)
  } finally {
    await browser.close()
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    url: '',
    out: '',
    width: undefined,
    height: undefined,
    mobile: false,
    full: false,
    wait: 1000,
    idle: 800,
    timeout: 30_000,
    scale: undefined,
    auth: true,
    mock: true,
    apiMock: true,
    apiDelay: 0,
    accessToken: '',
    refreshToken: '',
    chromePath: undefined,
    keepProfile: false,
    headful: false,
    quiet: false,
    json: false,
    help: false,
    skipServerCheck: false,
    debug: false,
  }
  const valueFlags = new Set([
    '--url', '--out', '--width', '--height', '--wait', '--idle', '--timeout', '--budget',
    '--scale', '--chrome', '--api-delay', '--token', '--refresh-token',
  ])
  const booleanFlags = {
    '--mobile': ['mobile', true],
    '--full': ['full', true],
    '--no-full': ['full', false],
    '--auth': ['auth', true],
    '--no-auth': ['auth', false],
    '--mock': ['mock', true],
    '--no-mock': ['mock', false],
    '--api-mock': ['apiMock', true],
    '--no-api-mock': ['apiMock', false],
    '--keep-profile': ['keepProfile', true],
    '--headful': ['headful', true],
    '--quiet': ['quiet', true],
    '--json': ['json', true],
    '--debug': ['debug', true],
    '--help': ['help', true],
    '-h': ['help', true],
    '--skip-server-check': ['skipServerCheck', true],
  }

  for (let index = 0; index < argv.length; index++) {
    let token = argv[index]
    let inlineValue
    if (token.includes('=') && !token.startsWith('=')) {
      const eqIndex = token.indexOf('=')
      inlineValue = token.slice(eqIndex + 1)
      token = token.slice(0, eqIndex)
    }
    if (booleanFlags[token]) {
      const [key, value] = booleanFlags[token]
      args[key] = value
      continue
    }
    if (valueFlags.has(token)) {
      const value = inlineValue !== undefined ? inlineValue : argv[++index]
      if (value === undefined) throw new Error(`参数 ${token} 缺少值`)
      if (token === '--url') args.url = value
      else if (token === '--out') args.out = value
      else if (token === '--chrome') args.chromePath = value
      else if (token === '--token') args.accessToken = value
      else if (token === '--refresh-token') args.refreshToken = value
      else if (token === '--api-delay') args.apiDelay = Number(value)
      else if (token === '--budget') args.timeout = Number(value)
      else args[token.slice(2)] = Number(value)
      continue
    }
    throw new Error(`未知参数：${token}`)
  }

  if (args.mobile) {
    if (args.width === undefined) args.width = DEFAULT_MOBILE.width
    if (args.height === undefined) args.height = DEFAULT_MOBILE.height
  }
  if (args.width === undefined) args.width = DEFAULT_DESKTOP.width
  if (args.height === undefined) args.height = DEFAULT_DESKTOP.height
  return args
}

export function printUsage() {
  console.log(
    [
      '无头浏览器截图工具（零依赖，直接调用本机 Chrome）',
      '',
      '用法：',
      '  node scripts/shot.mjs --url http://127.0.0.1:5173/ --out shots/home.png',
      '  node scripts/shot.mjs --url http://127.0.0.1:5173/ --mobile --full --out shots/home-mobile.png',
      '  node scripts/shot.mjs --url http://127.0.0.1:5173/login --no-auth --out shots/login.png',
      '',
      '参数：--url --out --width --height --mobile --scale --full --wait --idle --timeout(check --budget)',
      '      --auth/--no-auth --mock/--no-mock --api-mock/--no-api-mock --api-delay',
      '      --token --refresh-token --chrome --keep-profile --headful --json --quiet',
      '',
      '说明：移动端 = CDP Emulation.setDeviceMetricsOverride(390×844, dsf2, mobile, iPhone UA)，',
      '      不是 --window-size；输出 PNG 为 780×1688（CSS 视口 390×844），--scale 1 可得到精确 390×844。',
    ].join('\n'),
  )
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (args.help) {
    printUsage()
    return
  }
  if (!args.url) throw new Error('缺少 --url 参数（例：--url http://127.0.0.1:5173/）')
  const result = await takeScreenshot(args)
  if (args.json) console.log(JSON.stringify(result, null, 2))
  else if (!args.quiet) console.log(`截图完成：${result.out}`)
  return result
}

const isMain = (() => {
  if (!process.argv[1]) return false
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return false
  }
})()

if (isMain) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\n✗ 截图失败：${message}`)
    process.exitCode = 1
  })
}

export { main as shotMain, parseArgs, profileDirectory, killChrome, IPHONE_UA, DEFAULT_AUTH_TOKENS }
