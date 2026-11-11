/**
 * 用 CDP 截图的最小工具（不依赖 puppeteer / playwright）。
 *
 * 用法：
 *   node scripts/cdp-shot.mjs --url http://localhost:5173/ --out shots/home.png
 *   node scripts/cdp-shot.mjs --url http://localhost:5173/ --out shots/home-m.png --mobile
 *   node scripts/cdp-shot.mjs --url "http://localhost:5173/?mock=1" --out shots/home.png --full --wait 2500
 *   node scripts/cdp-shot.mjs --url ... --out ... --exec "localStorage.setItem('xyz:accent','pink')"
 *
 * 参数：
 *   --url    要截的地址（必填）
 *   --out    输出 png（必填）
 *   --width  视口宽，默认 1440
 *   --height 视口高，默认 900
 *   --mobile 390×844 的移动端模拟（CDP device metrics，不是 window-size）
 *   --full   整页截图
 *   --wait   加载完成后再等的毫秒数，默认 1200（留给骨架/图片/接口）
 *   --exec   截图前在页面里执行的 JS（切主题、种状态、启动播放等）
 *   --budget 最长等待毫秒，默认 15000
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

function parseArgs(argv) {
  const args = {
    url: null,
    out: null,
    width: 1440,
    height: 900,
    mobile: false,
    full: false,
    wait: 1200,
    budget: 15000,
    exec: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    const value = argv[i + 1]
    switch (key) {
      case '--url':
        args.url = value
        i += 1
        break
      case '--out':
        args.out = value
        i += 1
        break
      case '--width':
        args.width = Number(value)
        i += 1
        break
      case '--height':
        args.height = Number(value)
        i += 1
        break
      case '--wait':
        args.wait = Number(value)
        i += 1
        break
      case '--budget':
        args.budget = Number(value)
        i += 1
        break
      case '--exec':
        args.exec = value
        i += 1
        break
      case '--mobile':
        args.mobile = true
        break
      case '--mock':
        args.mock = true
        break
      case '--full':
        args.full = true
        break
      default:
        break
    }
  }
  if (args.mobile) {
    args.width = 390
    args.height = 844
  }
  return args
}

async function waitForDebuggerUrl(child, deadline) {
  return await new Promise((resolveUrl, rejectUrl) => {
    let buffer = ''
    const onData = (chunk) => {
      buffer += String(chunk)
      const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) {
        child.stderr.off('data', onData)
        resolveUrl(match[1])
      }
    }
    child.stderr.on('data', onData)
    const timer = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(timer)
        child.stderr.off('data', onData)
        rejectUrl(new Error('等不到 Chrome 的 DevTools 地址'))
      }
    }, 100)
  })
}

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.listeners = new Map()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id !== undefined) {
        const entry = this.pending.get(msg.id)
        if (!entry) return
        this.pending.delete(msg.id)
        if (msg.error) entry.reject(new Error(msg.error.message))
        else entry.resolve(msg.result)
        return
      }
      const handlers = this.listeners.get(msg.method)
      if (handlers) handlers.forEach((handler) => handler(msg.params))
    })
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', () => rej(new Error('无法连上 CDP WebSocket')), { once: true })
    })
    return new Cdp(ws)
  }

  send(method, params = {}) {
    this.id += 1
    const id = this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend })
    })
  }

  once(method) {
    return new Promise((resolveOnce) => {
      const handler = (params) => {
        const handlers = this.listeners.get(method) ?? []
        this.listeners.set(
          method,
          handlers.filter((h) => h !== handler),
        )
        resolveOnce(params)
      }
      const handlers = this.listeners.get(method) ?? []
      this.listeners.set(method, [...handlers, handler])
    })
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.url || !args.out) {
    console.error('缺少参数：--url 与 --out 是必填的')
    process.exit(1)
  }

  const chrome = CHROME_CANDIDATES.find((candidate) => {
    try {
      const probe = spawn(candidate, ['--version'], { stdio: 'ignore', windowsHide: true })
      probe.unref()
      return true
    } catch {
      return false
    }
  })
  if (!chrome) {
    console.error('找不到 Chrome / Edge，无法截图')
    process.exit(1)
  }

  // 每次用独立的 profile 目录：Chrome 会复用已有实例的端口，
  // 固定端口/固定 profile 会导致第二次运行连不上。
  const profileDir = resolve(tmpdir(), `chrome-xyz-shot-${process.pid}-${Date.now()}`)

  const child = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
  )

  const startedAt = Date.now()
  let exitCode = 0
  try {
    const browserWsUrl = await waitForDebuggerUrl(child, startedAt + args.budget)
    const port = Number(new URL(browserWsUrl).port)

    // 优先用「页面」目标：browser 端点上没有 Page 域
    let pageWsUrl = browserWsUrl
    for (let i = 0; i < 40; i += 1) {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) {
        pageWsUrl = page.webSocketDebuggerUrl
        break
      }
      await sleep(100)
    }

    const cdp = await Cdp.connect(pageWsUrl)

    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: args.width,
      height: args.height,
      deviceScaleFactor: args.mobile ? 2 : 1,
      mobile: args.mobile,
    })

    if (args.mobile) {
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
      await cdp.send('Emulation.setUserAgentOverride', {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      })
    }

    const goto = async (url) => {
      const loaded = cdp.once('Page.loadEventFired')
      await cdp.send('Page.navigate', { url })
      await Promise.race([loaded, sleep(args.budget)])
    }

    // --mock：先落到同一个 origin 上种 localStorage 开关，再去目标地址。
    // （URL 里带 ?mock=1 也行，但 shell 里的 & 容易被命令行拆断）
    if (args.mock) {
      await goto(new URL(args.url).origin)
      await sleep(400)
      await cdp
        .send('Runtime.evaluate', { expression: "localStorage.setItem('xyz-mock','on')" })
        .catch(() => null)
    }

    await goto(args.url)
    await sleep(args.wait)

    if (args.exec) {
      await cdp
        .send('Runtime.evaluate', { expression: args.exec, awaitPromise: true, returnByValue: true })
        .catch(() => null)
      await sleep(800)
    }

    let captureHeight = args.height
    if (args.full) {
      const metrics = await cdp.send('Page.getLayoutMetrics')
      captureHeight = Math.min(
        Math.ceil(metrics.cssContentSize?.height ?? metrics.contentSize.height),
        15000,
      )
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: args.width,
        height: captureHeight,
        deviceScaleFactor: args.mobile ? 2 : 1,
        mobile: args.mobile,
      })
      await sleep(400)
    }

    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: Boolean(args.full),
      ...(args.full
        ? { clip: { x: 0, y: 0, width: args.width, height: captureHeight, scale: 1 } }
        : {}),
    })

    const outPath = resolve(args.out)
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, Buffer.from(shot.data, 'base64'))

    // 顺便验证页面没有横向溢出（常见布局 bug）
    const overflow = await cdp
      .send('Runtime.evaluate', {
        expression:
          'JSON.stringify({scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, scrollH: document.documentElement.scrollHeight})',
        returnByValue: true,
      })
      .catch(() => null)
    const info = overflow?.result?.value ? JSON.parse(overflow.result.value) : null

    console.log(`OK ${args.out} ${args.width}x${args.full ? captureHeight : args.height}`)
    if (info) {
      const horizontalOverflow = info.scrollW - info.innerW
      console.log(
        `viewport=${info.innerW} scrollWidth=${info.scrollW} scrollHeight=${info.scrollH} 横向溢出=${
          horizontalOverflow > 0 ? `${horizontalOverflow}px` : '无'
        }`,
      )
    }
  } catch (error) {
    console.error(`截图失败：${error.message}`)
    exitCode = 1
  } finally {
    try {
      child.kill()
    } catch {
      // 已退出
    }
    await sleep(300)
    try {
      rmSync(profileDir, { recursive: true, force: true })
    } catch {
      // 删不掉就算了，在系统临时目录里
    }
  }
  process.exit(exitCode)
}

main()
