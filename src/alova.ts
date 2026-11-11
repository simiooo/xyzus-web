import { createAlova } from 'alova'
import adapterFetch from 'alova/fetch'
import type { AlovaRequestAdapter, Method } from 'alova'
import { message } from 'antd'

const MAX_RETRY = 1

/**
 * 请求适配器：默认走原生 fetch；开发期启用 mock 时，`src/main.tsx` 会把
 * mock adapter 挂到 `window.__XYZ_MOCK_ADAPTER__`，这里在每次请求时读取，
 * 这样 mock 模块（fixtures 等）不会被打进生产主包。
 */
type LooseAdapter = (elements: unknown, method: unknown) => unknown

const requestAdapter = ((elements: unknown, method: unknown) => {
  const mock = typeof window !== 'undefined' ? window.__XYZ_MOCK_ADAPTER__ : undefined
  const adapter = (mock ?? adapterFetch()) as unknown as LooseAdapter
  return adapter(elements, method)
}) as unknown as AlovaRequestAdapter<RequestInit, Response, Headers>

/** 网络层失败（fetch/连接被拒/超时）的中文提示，别让页面出现英文 "Failed to fetch"。 */
const NETWORK_ERROR_MESSAGE =
  '网络异常：请求没有送达后端。请确认 xyz 后端已启动（默认 http://localhost:23020），或检查网络后重试。'

let getTokens: () => { accessToken: string | null; refreshToken: string | null }
let setTokens: (access: string, refresh: string) => void
let clearAuth: () => void
let refreshInProgress: Promise<boolean> | null = null

export function initAlovaDeps(
  getFn: typeof getTokens,
  setFn: typeof setTokens,
  clearFn: typeof clearAuth,
) {
  getTokens = getFn
  setTokens = setFn
  clearAuth = clearFn
}

function hasCJK(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text)
}

const HTTP_MESSAGES: Record<number, string> = {
  400: '请求参数错误（HTTP 400）：请检查客户端请求体与 xyz 后端契约是否一致',
  401: '身份认证失效，请重新登录',
  403: '没有权限访问该内容（HTTP 403）',
  404: '接口或资源不存在（HTTP 404）',
  405: '请求方法不支持（HTTP 405）',
  500: '后端内部错误（HTTP 500），请稍后重试',
  502: '网关错误（HTTP 502），后端暂不可用',
  503: '后端服务不可用（HTTP 503），请稍后重试',
  504: '后端响应超时（HTTP 504），请稍后重试',
}

/** 后端的 msg 本来就是中文就直接用；否则按 HTTP code 给可读中文。 */
function readableBizMessage(code: number | undefined, rawMsg: string | undefined): string {
  if (rawMsg && hasCJK(rawMsg)) return rawMsg
  if (code !== undefined && HTTP_MESSAGES[code]) return HTTP_MESSAGES[code]
  return rawMsg || `接口返回业务错误${code !== undefined ? `（code:${code}）` : ''}`
}

function createBusinessError(code: number | undefined, rawMsg: string | undefined): Error {
  const error = new Error(readableBizMessage(code, rawMsg))
  error.name = 'BusinessError'
  ;(error as Error & { code?: number }).code = code
  return error
}

function isNetworkError(error: Error): boolean {
  return /Failed to fetch|NetworkError|fetch failed|Load failed|ERR_|ECONN|ETIMEDOUT|network timeout|aborted/i.test(
    error.message,
  )
}

function emitAuthExpired() {
  try {
    window.dispatchEvent(new CustomEvent('auth:expired'))
  } catch {
    window.location.href = '/login'
  }
}

export async function refreshTokens(
  getFn: () => { accessToken: string | null; refreshToken: string | null },
  setFn: (access: string, refresh: string) => void,
  clearFn: () => void,
): Promise<boolean> {
  const { accessToken, refreshToken } = getFn()
  if (!accessToken || !refreshToken) {
    clearFn()
    return false
  }

  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'x-jike-access-token': accessToken,
        'x-jike-refresh-token': refreshToken,
      }),
    })
    if (!res.ok) throw new Error(`refresh token failed: HTTP ${res.status}`)

    const body = (await res.json()) as { code?: number; msg?: string; data?: Record<string, unknown> }
    if (body.code !== 0 && body.code !== 200) {
      throw new Error(body.msg || 'refresh token failed')
    }

    // 后端信封 data 里是上游 body（token 在顶层），个别版本可能再包一层 data。
    const payload = (body.data ?? {}) as Record<string, unknown>
    const nested = payload.data as Record<string, unknown> | undefined
    const newAccess = (payload['x-jike-access-token'] ?? nested?.['x-jike-access-token']) as string | undefined
    const newRefresh = (payload['x-jike-refresh-token'] ?? nested?.['x-jike-refresh-token']) as string | undefined
    if (!newAccess || !newRefresh) throw new Error('refresh response invalid: no tokens')

    setFn(newAccess, newRefresh)
    return true
  } catch {
    clearFn()
    return false
  }
}

async function tryRefreshToken(): Promise<boolean> {
  if (refreshInProgress) return refreshInProgress

  refreshInProgress = (async () => {
    const result = await refreshTokens(getTokens, setTokens, clearAuth)
    if (!result) {
      emitAuthExpired()
    }
    return result
  })()

  try {
    return await refreshInProgress
  } finally {
    refreshInProgress = null
  }
}

const alova = createAlova({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  requestAdapter,
  beforeRequest(method: Method) {
    const { accessToken } = getTokens?.() ?? { accessToken: null }
    if (accessToken) {
      method.config.headers = {
        ...method.config.headers,
        'x-jike-access-token': accessToken,
      }
    }
  },
  responded: {
    onSuccess: async (response: Response, method: Method) => {
      if (response.status === 401) {
        const retryCount = (method.config as Record<string, unknown>).__retryCount as number | undefined
        if (retryCount && retryCount >= MAX_RETRY) {
          clearAuth()
          emitAuthExpired()
          throw new Error('Token expired')
        }
        (method.config as Record<string, unknown>).__retryCount = (retryCount ?? 0) + 1

        const refreshed = await tryRefreshToken()
        if (!refreshed) {
          throw new Error('Token expired')
        }
        const { accessToken } = getTokens()
        if (accessToken) {
          method.config.headers = {
            ...method.config.headers,
            'x-jike-access-token': accessToken,
          }
        }
        return method.send()
      }

      let json: { code?: number; msg?: string; data?: unknown }
      try {
        json = (await response.clone().json()) as typeof json
      } catch {
        throw createBusinessError(response.status, `后端返回了非 JSON 响应（HTTP ${response.status}）`)
      }

      if (json.code !== 0 && json.code !== 200) {
        throw createBusinessError(json.code ?? response.status, json.msg)
      }
      return json.data
    },
    onError: (error: Error) => {
      // 业务错误 / token 失效：保留 reject，让调用方（页面、authStore）拿到可读的中文 message。
      if (error.name === 'BusinessError' || error.message === 'Token expired') {
        throw error
      }
      if (isNetworkError(error)) {
        message.error(NETWORK_ERROR_MESSAGE)
        throw new Error(NETWORK_ERROR_MESSAGE)
      }
      message.error(error.message || '请求失败，请稍后重试')
      throw error
    },
  },
})

export default alova
