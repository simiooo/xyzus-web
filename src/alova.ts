import { createAlova } from 'alova'
import adapterFetch from 'alova/fetch'
import type { Method } from 'alova'
import { message } from 'antd'

const MAX_RETRY = 1

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
    if (!res.ok) throw new Error('Refresh failed')

    const body = await res.json()
    if (body.code !== 0 && body.code !== 200) {
      throw new Error(body.msg || 'Refresh failed')
    }

    const newAccess = body.data?.['x-jike-access-token']
    const newRefresh = body.data?.['x-jike-refresh-token']
    if (!newAccess || !newRefresh) throw new Error('Refresh response invalid')

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
  requestAdapter: adapterFetch(),
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

      const json = await response.clone().json()
      if (json.code !== 0 && json.code !== 200) {
        const bizErr = new Error(json.msg || 'Request failed')
        bizErr.name = 'BusinessError'
        throw bizErr
      }
      return json.data
    },
    onError: (err: Error) => {
      if (err.name === 'BusinessError' || err.message === 'Token expired') return
      message.error(err.message || 'Network error, please try again later')
    },
  },
})

export default alova
