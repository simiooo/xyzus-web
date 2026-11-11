#!/usr/bin/env node
/**
 * 全站路由批量截图（桌面 + 移动），输出到 `shots/`。
 *
 * 基于 `scripts/shot.mjs`（同一套 CDP 实现）：一次启动 Chrome，逐页
 * `Emulation.setDeviceMetricsOverride` 切换尺寸 → 导航 → 等网络空闲/内容渲染 → 截图。
 * 内置 API mock 拦截，所以即使 src/alova.ts 还没接 VITE_API_MOCK，也能截到完整 mock 数据。
 *
 * 用法：
 *   node scripts/shoot-all.mjs
 *   node scripts/shoot-all.mjs --base-url http://127.0.0.1:5173
 *   node scripts/shoot-all.mjs --only home,episode,login --mobile-only
 *   node scripts/shoot-all.mjs --full          # 整页截图（默认是视口截图）
 *
 * 参数：
 *   --base-url      前端地址（默认 http://127.0.0.1:5173）
 *   --out-dir       输出目录（默认 shots）
 *   --only          只截指定路由（逗号分隔的 route name）
 *   --desktop-only / --mobile-only
 *   --full          整页截图
 *   --wait/--idle/--timeout/--api-delay/--chrome/--quiet/--keep-profile  透传给 shot.mjs
 *
 * 输出命名：`<route>-desktop.png` / `<route>-mobile.png`
 *   桌面 1440×900（dsf 1）→ PNG 1440×900
 *   移动 390×844（dsf 2、mobile、iPhone UA）→ PNG 780×1688（CSS 视口 390×844）
 */
import { launchChrome, assertServerReachable } from './shot.mjs'

export const ROUTES = [
  { name: 'home', path: '/', auth: true },
  { name: 'search', path: '/search', auth: true },
  { name: 'search-keyword', path: `/search?keyword=${encodeURIComponent('深夜')}`, auth: true },
  { name: 'categories', path: '/categories', auth: true },
  { name: 'category-arts', path: '/category/cat-arts', auth: true },
  { name: 'toplist-hot', path: '/toplist/HOT', auth: true },
  { name: 'editor-picks', path: '/editor-picks', auth: true },
  { name: 'podcast', path: '/podcast/mock-pid', auth: true },
  { name: 'episode', path: '/episode/mock-eid', auth: true },
  { name: 'favorites', path: '/favorites', auth: true },
  { name: 'subscriptions', path: '/subscriptions', auth: true },
  { name: 'inbox', path: '/inbox', auth: true },
  { name: 'login', path: '/login', auth: false },
]

const DESKTOP = { suffix: 'desktop', width: 1440, height: 900, mobile: false, scale: 1 }
const MOBILE = { suffix: 'mobile', width: 390, height: 844, mobile: true, scale: 2 }

function parseArgs(argv) {
  const args = {
    baseUrl: 'http://127.0.0.1:5173',
    outDir: 'shots',
    only: null,
    desktop: true,
    mobile: true,
    full: false,
    wait: undefined,
    idle: undefined,
    timeout: undefined,
    apiDelay: undefined,
    chromePath: undefined,
    keepProfile: false,
    quiet: false,
  }
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]
    if (token === '--base-url') args.baseUrl = argv[++index]
    else if (token === '--out-dir') args.outDir = argv[++index]
    else if (token === '--only') args.only = argv[++index].split(',').map((name) => name.trim()).filter(Boolean)
    else if (token === '--desktop-only') args.mobile = false
    else if (token === '--mobile-only') args.desktop = false
    else if (token === '--full') args.full = true
    else if (token === '--wait') args.wait = Number(argv[++index])
    else if (token === '--idle') args.idle = Number(argv[++index])
    else if (token === '--timeout') args.timeout = Number(argv[++index])
    else if (token === '--api-delay') args.apiDelay = Number(argv[++index])
    else if (token === '--chrome') args.chromePath = argv[++index]
    else if (token === '--keep-profile') args.keepProfile = true
    else if (token === '--quiet') args.quiet = true
    else if (token === '--help' || token === '-h') {
      console.log(
        '用法：node scripts/shoot-all.mjs [--base-url http://127.0.0.1:5173] [--out-dir shots]\n' +
          '      [--only home,episode,login] [--desktop-only|--mobile-only] [--full] [--quiet]',
      )
      process.exit(0)
    }
    else throw new Error(`未知参数：${token}`)
  }
  return args
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function pad(text, width) {
  const value = String(text)
  return value.length >= width ? value : value + ' '.repeat(width - value.length)
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  const base = args.baseUrl.replace(/\/+$/, '')
  await assertServerReachable(`${base}/`)

  const sizes = []
  if (args.desktop) sizes.push(DESKTOP)
  if (args.mobile) sizes.push(MOBILE)
  const routes = args.only ? ROUTES.filter((route) => args.only.includes(route.name)) : ROUTES
  if (args.only) {
    const missing = args.only.filter((name) => !ROUTES.some((route) => route.name === name))
    if (missing.length > 0) throw new Error(`--only 里的路由不存在：${missing.join(', ')}`)
  }

  const jobs = []
  for (const route of routes) {
    for (const size of sizes) {
      jobs.push({ route, size })
    }
  }

  if (!args.quiet) {
    console.log(`[shoot-all] ${base} → ${args.outDir}/，共 ${jobs.length} 张（${routes.length} 路由 × ${sizes.length} 尺寸）`)
  }

  const browser = await launchChrome({
    chromePath: args.chromePath,
    keepProfile: args.keepProfile,
    quiet: args.quiet,
    apiMock: true,
    apiDelay: args.apiDelay ?? 0,
  })

  const results = []
  const failures = []
  try {
    for (const { route, size } of jobs) {
      const out = `${args.outDir}/${route.name}-${size.suffix}.png`
      const url = `${base}${route.path}`
      try {
        const result = await browser.capture({
          url,
          out,
          width: size.width,
          height: size.height,
          mobile: size.mobile,
          scale: size.scale,
          full: args.full,
          wait: args.wait,
          idle: args.idle,
          timeout: args.timeout,
          auth: route.auth,
          mock: true,
          quiet: true,
        })
        results.push({ route: route.name, size: size.suffix, ...result })
        if (!args.quiet) {
          const dims = result.pngWidth ? `${result.pngWidth}x${result.pngHeight}` : '?'
          const overflow = result.horizontalOverflow > 0 ? `溢出+${result.horizontalOverflow}px` : '无溢出'
          const exceptionFlag = result.exceptions.length > 0 ? `异常${result.exceptions.length}` : '无异常'
          console.log(
            `  ${pad(route.name + '/' + size.suffix, 24)} ${pad(dims, 12)} ${pad(formatBytes(result.bytes), 9)} ` +
              `横向${overflow} ${exceptionFlag}${result.timedOut ? ' 等待超时' : ''}`,
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push({ route: route.name, size: size.suffix, message })
        console.error(`  ✗ ${route.name}/${size.suffix} 失败：${message}`)
      }
    }
  } finally {
    await browser.close()
  }

  if (!args.quiet) {
    console.log('')
    console.log(`[shoot-all] 完成 ${results.length} / ${jobs.length} 张，输出目录：${args.outDir}/`)
    const brokenExceptions = results.filter((result) => result.exceptions.length > 0)
    if (brokenExceptions.length > 0) {
      console.log('[shoot-all] 有页面运行时异常（截图仍已产出，供排查）：')
      for (const result of brokenExceptions) {
        console.log(`  - ${result.route}/${result.size}: ${result.exceptions[0]}`)
      }
    }
    const overflowing = results.filter((result) => result.horizontalOverflow > 0)
    if (overflowing.length > 0) {
      console.log('[shoot-all] 横向溢出（移动端最容易出假 bug，查看对应截图）：')
      for (const result of overflowing) {
        console.log(`  - ${result.route}/${result.size}: +${result.horizontalOverflow}px`)
      }
    }
  }
  if (failures.length > 0) {
    process.exitCode = 1
  }
  return { results, failures }
}

const isMain = (() => {
  if (!process.argv[1]) return false
  try {
    const scriptUrl = new URL(import.meta.url).href
    return scriptUrl === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href
  } catch {
    return false
  }
})()

if (isMain) {
  main().catch((error) => {
    console.error(`\n✗ 批量截图失败：${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}

export { main as shootAllMain, parseArgs }
