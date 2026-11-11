/**
 * Alova mock requestAdapter —— 离线开发 / 截图验收用
 *
 * 用法（Lead 在 src/alova.ts 里接入）：
 *
 * ```ts
 * // 方式 A（推荐，自动判定：VITE_API_MOCK / ?mock=1 / localStorage）
 * import { createMockAdapter } from '@/mock/adapter'
 * const alova = createAlova({ baseURL: ..., requestAdapter: createMockAdapter(), ... })
 *
 * // 方式 B（显式开关，便于和 alova.ts 里原有的 adapterFetch 二选一）
 * import { createMockAdapter } from '@/mock/adapter'
 * requestAdapter: import.meta.env.VITE_API_MOCK === '1'
 *   ? createMockAdapter({ enabled: true })
 *   : adapterFetch()
 * ```
 *
 * 启用方式（按优先级从高到低）：
 * 1. 当前页面 URL 带 `?mock=1`（会写进 localStorage，SPA 内部跳转后仍然生效）
 * 2. `window.__XYZ_MOCK__ = true/false`
 * 3. `localStorage.setItem('xyz-mock', 'on')` / `'off'`（浏览器控制台随时切换）
 * 4. 构建时环境变量 `VITE_API_MOCK=1`（`VITE_API_MOCK=1 pnpm dev`）
 *
 * 未启用的请求会 pass-through 到真实 fetch（不改变原有联调行为）。
 * 未实现的端点默认也 pass-through（可通过 `passThrough: false` 改成返回 404 业务错误）。
 *
 * 说明：只实现 mock 需要的最小 adapter 契约（response / headers / abort）。
 */
import type { AlovaRequestAdapter, RequestElements } from 'alova'
import {
  DEFAULT_MOCK_DELAY,
  MOCK_ENDPOINT_LIST,
  isMockEndpoint,
  resolveEndpointName,
  resolveMockDelay,
  resolveMockResponse,
  type MockBody,
} from './handlers.ts'

/** localStorage 里保存 mock 开关的 key（也可以用 xyz-mock-delay 控制延时） */
export const MOCK_STORAGE_KEY = 'xyz-mock'
/** localStorage 里保存 mock 延时的 key */
export const MOCK_DELAY_STORAGE_KEY = 'xyz-mock-delay'

export interface CreateMockAdapterOptions {
  /**
   * - true：始终 mock
   * - false：始终 pass-through（等价于原来的 adapterFetch）
   * - 'auto'（默认）：每次请求时检查 URL / localStorage / window / VITE_API_MOCK
   */
  enabled?: boolean | 'auto'
  /** mock 响应的默认延时（ms），默认 600；可用 `?delay=` 或 body.__delay 覆盖，0 表示不延时 */
  delay?: number
  /** 未实现的端点是否直接 pass-through 到真实 fetch，默认 true */
  passThrough?: boolean
  /** 打开后会在控制台打印每个 mock 请求的端点与耗时 */
  log?: boolean
  /** 自定义 fetch（测试用），默认用全局 fetch */
  fetchImpl?: typeof fetch
}

const TRUE_FLAGS = ['1', 'true', 'on', 'yes', 'enabled']
const FALSE_FLAGS = ['0', 'false', 'off', 'no', 'disabled']

function readEnvFlag(): string {
  try {
    const env = import.meta.env as unknown as Record<string, unknown> | undefined
    return String(env?.VITE_API_MOCK ?? '').trim().toLowerCase()
  } catch {
    return ''
  }
}

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

/**
 * 判断当前环境是否启用 mock。
 * 注意：`?mock=0` 是显式关闭（会覆盖 VITE_API_MOCK），用于临时连真实后端调试。
 */
export function isMockEnabled(): boolean {
  // 1. URL 参数（首次进入页面时生效，随后持久化到 localStorage，SPA 内部跳转不丢）
  if (typeof window !== 'undefined' && window.location) {
    try {
      const urlFlag = new URLSearchParams(window.location.search).get('mock')
      if (urlFlag !== null) {
        const normalized = urlFlag.trim().toLowerCase()
        if (TRUE_FLAGS.includes(normalized)) {
          writeStorage(MOCK_STORAGE_KEY, 'on')
          return true
        }
        if (FALSE_FLAGS.includes(normalized)) {
          writeStorage(MOCK_STORAGE_KEY, 'off')
          return false
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. 页面全局开关（浏览器控制台 / Playwright 等外部注入）
  if (typeof window !== 'undefined') {
    const globalFlag = (window as unknown as { __XYZ_MOCK__?: unknown }).__XYZ_MOCK__
    if (typeof globalFlag === 'boolean') return globalFlag
    if (typeof globalFlag === 'string') {
      const normalized = globalFlag.trim().toLowerCase()
      if (TRUE_FLAGS.includes(normalized)) return true
      if (FALSE_FLAGS.includes(normalized)) return false
    }
  }

  // 3. localStorage 开关（浏览器控制台随时切换，刷新后仍生效）
  const stored = readStorage(MOCK_STORAGE_KEY)
  if (stored !== null) {
    const normalized = stored.trim().toLowerCase()
    if (TRUE_FLAGS.includes(normalized)) return true
    if (FALSE_FLAGS.includes(normalized)) return false
  }

  // 4. 构建时环境变量
  const envFlag = readEnvFlag()
  if (TRUE_FLAGS.includes(envFlag)) return true
  if (FALSE_FLAGS.includes(envFlag)) return false

  return false
}

/** 把 alova 的 request data 解析成 body 对象 */
function parseRequestBody(data: unknown): MockBody {
  if (data === undefined || data === null) return {}
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as MockBody)
        : {}
    } catch {
      return {}
    }
  }
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
    const result: MockBody = {}
    data.forEach((value, key) => {
      result[key] = value
    })
    return result
  }
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const result: MockBody = {}
    data.forEach((value, key) => {
      result[key] = value
    })
    return result
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    return data as MockBody
  }
  return {}
}

function isSpecialBody(data: unknown): boolean {
  if (typeof data === 'string') return true
  if (typeof FormData !== 'undefined' && data instanceof FormData) return true
  if (typeof Blob !== 'undefined' && data instanceof Blob) return true
  if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) return true
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) return true
  if (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream) return true
  return false
}

function buildFetchHeaders(elements: RequestElements): Headers {
  const headers = new Headers()
  const rawHeaders = elements.headers ?? {}
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value === undefined || value === null || value === false || value === '') continue
    try {
      headers.set(key, String(value))
    } catch {
      // ignore invalid header names
    }
  }
  return headers
}

async function realFetch(
  elements: RequestElements,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<Response> {
  const headers = buildFetchHeaders(elements)
  const data = elements.data as unknown
  if (data === undefined || data === null) {
    return fetchImpl(elements.url, {
      method: elements.type,
      headers,
      signal,
    })
  }
  if (!isSpecialBody(data) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=UTF-8')
  }
  const body: BodyInit = isSpecialBody(data)
    ? (data as BodyInit)
    : JSON.stringify(data)
  return fetchImpl(elements.url, {
    method: elements.type,
    headers,
    body,
    signal,
  })
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  })
}

function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort(): void {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function readLogFlag(options: CreateMockAdapterOptions): boolean {
  if (typeof options.log === 'boolean') return options.log
  const stored = readStorage('xyz-mock-log')
  return stored === '1' || stored === 'on' || stored === 'true'
}

/**
 * 创建一个 alova 兼容的 mock requestAdapter。
 *
 * 返回的 adapter 契约与 `alova/fetch` 的 adapter 一致：`{ response, headers, abort }`。
 */
export function createMockAdapter(
  options: CreateMockAdapterOptions = {},
): AlovaRequestAdapter<RequestInit, Response, Headers> {
  const delay = options.delay ?? DEFAULT_MOCK_DELAY
  const passThrough = options.passThrough ?? true
  const enabledMode = options.enabled ?? 'auto'
  const fetchImpl: typeof fetch | undefined =
    options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined)
  const logging = readLogFlag(options)

  function isEnabledForRequest(): boolean {
    if (enabledMode === 'auto') return isMockEnabled()
    return enabledMode
  }

  return (elements) => {
    const endpoint = resolveEndpointName(elements.url)
    const body = parseRequestBody(elements.data)
    const requestDelay = resolveMockDelay(elements.url, body, delay)
    const controller = new AbortController()

    const resolved = (async (): Promise<Response> => {
      if (requestDelay > 0) {
        await sleepWithAbort(requestDelay, controller.signal)
      }
      if (!isEnabledForRequest()) {
        if (!fetchImpl) throw new Error('[mock] 当前环境缺少 fetch，无法 pass-through')
        return realFetch(elements, fetchImpl, controller.signal)
      }
      if (!isMockEndpoint(endpoint)) {
        if (passThrough) {
          if (!fetchImpl) {
            throw new Error(`[mock] 未实现的端点：${endpoint}（且缺少 fetch 无法 pass-through）`)
          }
          return realFetch(elements, fetchImpl, controller.signal)
        }
        return jsonResponse(
          {
            code: 40400,
            msg: `[mock] 未实现的端点：${endpoint}（可用端点见 src/mock/handlers.ts）`,
            data: null,
          },
          404,
        )
      }
      const startedAt = Date.now()
      try {
        const data = resolveMockResponse(endpoint, body)
        if (logging && typeof console !== 'undefined') {
          console.info(
            `[mock] ${endpoint} (${elements.type}) ${Date.now() - startedAt}ms + ${requestDelay}ms delay`,
          )
        }
        return jsonResponse({ code: 0, msg: 'success', data })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (logging && typeof console !== 'undefined') {
          console.warn(`[mock] ${endpoint} failed: ${message}`)
        }
        return jsonResponse({ code: 50000, msg: message, data: null }, 500)
      }
    })()

    return {
      response: () => resolved.then((response) => response.clone()),
      headers: () => resolved.then((response) => response.headers, () => new Headers()),
      abort: () => controller.abort(),
    }
  }
}

/** 已实现的端点清单（供调试页 / README / 测试断言使用） */
export { MOCK_ENDPOINT_LIST, isMockEndpoint, resolveEndpointName, resolveMockResponse }

export { DEFAULT_MOCK_DELAY }

export default createMockAdapter
