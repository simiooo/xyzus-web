import { create } from 'zustand'
import { initAlovaDeps } from '@/alova'
import { sendCodeAPI, loginAPI, profileAPI } from '@/api/auth'
import type { LoginSession, SendCodeResult, UserProfile } from '@/api/types'

const ACCESS_KEY = 'x-jike-access-token'
const REFRESH_KEY = 'x-jike-refresh-token'
const PROFILE_KEY = 'x-jike-user-profile'

/** 上游验证码风控的兜底提示（小宇宙对 /sendCode、/login 有阿里云滑块风控）。 */
const RISK_CONTROL_HINT =
  '小宇宙上游对验证码下发/登录有风控（阿里云滑块），可能返回 code:1003 或 404。可稍后重试；' +
  '若持续失败，请在手机小宇宙 App 内登录后获取 x-jike-access-token / x-jike-refresh-token，用「粘贴已有 token 登录」兜底。'

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

function loadTokens(): { accessToken: string | null; refreshToken: string | null } {
  try {
    return {
      accessToken: localStorage.getItem(ACCESS_KEY),
      refreshToken: localStorage.getItem(REFRESH_KEY),
    }
  } catch {
    return { accessToken: null, refreshToken: null }
  }
}

function saveTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

function removeTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(PROFILE_KEY)
}

/**
 * 登出 / 登录失效时清掉该账号的本地缓存与写队列，避免换号隐私残留。
 * 动态 import 断开 authStore ↔ db/schema 的循环依赖；清理失败静默降级。
 */
function purgeLocalCache(uid: string | undefined) {
  if (!uid) return
  void import('@/db/schema')
    .then(({ clearAccountCache }) => clearAccountCache(uid))
    .catch(() => {})
}

function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as UserProfile) : null
  } catch {
    return null
  }
}

function persistProfile(profile: UserProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // 存不下不影响登录
  }
}

/** 把任意失败转成可以直接展示给用户的中文 Error，不吞掉上游原因。 */
function toReadableAuthError(error: unknown, action: 'sendCode' | 'login' | 'profile'): AuthError {
  if (error instanceof AuthError) return error
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const text = raw.trim()

  if (/网络|Network|Failed to fetch|ERR_CONNECTION|ECONN|timeout/i.test(text)) {
    return new AuthError('网络异常：连不上后端服务（默认 http://localhost:23020），请确认 xyz 后端已启动后重试。')
  }
  if (action === 'profile') {
    return new AuthError(
      '粘贴的 token 无效或已过期（access token 与 refresh token 需要成对、来自同一次登录）。请回到小宇宙 App 重新获取后粘贴。',
    )
  }
  if (/404|不存在/i.test(text)) {
    return new AuthError(
      action === 'sendCode'
        ? `验证码发送失败：上游对手机号/登录接口返回 404（手机号未注册、格式不合法或接口风控调整）。${RISK_CONTROL_HINT}`
        : `登录失败：上游登录接口返回 404（手机号/验证码不被接受，可能触发风控）。${RISK_CONTROL_HINT}`,
    )
  }
  if (/401|身份认证|token|Token/i.test(text)) {
    return new AuthError(`登录状态失效：${text}`)
  }
  if (/400|错误请求|参数/i.test(text)) {
    return new AuthError(
      action === 'sendCode'
        ? '验证码发送失败：手机号/区号参数不合法，请检查后重试。'
        : '登录失败：手机号或验证码格式不合法，请检查后重试。',
    )
  }
  return new AuthError(
    action === 'sendCode'
      ? `验证码发送失败：${text || '未知错误'}。${RISK_CONTROL_HINT}`
      : `登录失败：${text || '未知错误'}。${RISK_CONTROL_HINT}`,
  )
}

/** sendCode 上游风控/业务失败会包在 HTTP 200 里：{success:false, code:1003, toast:"…"}。 */
function riskControlMessage(payload: SendCodeResult | null | undefined): string | null {
  if (!payload || typeof payload !== 'object') return null
  if (payload.success === false) {
    return `${payload.toast || '验证码发送失败（上游风控拦截）'}。${RISK_CONTROL_HINT}`
  }
  if (typeof payload.code === 'number' && payload.code !== 0 && payload.code !== 200) {
    return `验证码发送失败（上游返回 code:${payload.code}${payload.toast ? `：${payload.toast}` : ''}）。${RISK_CONTROL_HINT}`
  }
  return null
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserProfile | null
  isAuthenticated: boolean
  loading: boolean

  /** 手机号 + 验证码登录（上游有风控，失败时抛中文错误）。 */
  login: (phone: string, code: string, areaCode: string) => Promise<void>
  /** 发送验证码（上游有风控，失败时抛中文错误，含 toast/code:1003 识别）。 */
  sendCode: (phone: string, areaCode: string) => Promise<void>
  /** 「粘贴已有 token 登录」兜底：写入 token → 调 /profile 拉用户 → 置 isAuthenticated。 */
  loginWithTokens: (access: string, refresh: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

const useAuthStore = create<AuthState>((set, get) => {
  initAlovaDeps(
    () => loadTokens(),
    (access, refresh) => {
      saveTokens(access, refresh)
      set({ accessToken: access, refreshToken: refresh })
    },
    () => {
      purgeLocalCache(get().user?.uid)
      removeTokens()
      set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false })
    },
  )

  const tokens = loadTokens()

  const applySession = (session: LoginSession) => {
    saveTokens(session.accessToken, session.refreshToken)
    set({ accessToken: session.accessToken, refreshToken: session.refreshToken })
    if (session.user) {
      persistProfile(session.user)
      set({ user: session.user })
    }
  }

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: loadProfile(),
    isAuthenticated: false,
    loading: true,

    login: async (phone: string, code: string, areaCode: string) => {
      let session: LoginSession
      try {
        session = await loginAPI({
          mobilePhoneNumber: phone.trim(),
          verifyCode: code.trim(),
          areaCode: areaCode || '+86',
        })
      } catch (error) {
        throw toReadableAuthError(error, 'login')
      }

      if (!session.accessToken || !session.refreshToken) {
        throw new AuthError(`登录失败：上游没有返回 token（多半被风控拦截了）。${RISK_CONTROL_HINT}`)
      }

      applySession(session)

      // 登录响应里通常已带用户信息；少数情况下拿不到，再用 /profile 补一次。
      if (!session.user) {
        try {
          const profile = await profileAPI()
          persistProfile(profile)
          set({ user: profile })
        } catch (error) {
          removeTokens()
          set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, loading: false })
          throw toReadableAuthError(error, 'profile')
        }
      }

      set({ isAuthenticated: true, loading: false })
    },

    sendCode: async (phone: string, areaCode: string) => {
      let payload: SendCodeResult
      try {
        payload = await sendCodeAPI({ mobilePhoneNumber: phone.trim(), areaCode: areaCode || '+86' })
      } catch (error) {
        throw toReadableAuthError(error, 'sendCode')
      }

      const riskMessage = riskControlMessage(payload)
      if (riskMessage) throw new AuthError(riskMessage)
    },

    loginWithTokens: async (access: string, refresh: string) => {
      const accessToken = (access ?? '').trim()
      const refreshToken = (refresh ?? '').trim()

      if (!accessToken) {
        throw new AuthError('请粘贴 x-jike-access-token（必填）。可在小宇宙 App 内登录后从请求头/日志中复制。')
      }
      if (!refreshToken) {
        throw new AuthError('请粘贴 x-jike-refresh-token（必填）。两个 token 必须是同一次登录产生的，否则 401 无法刷新。')
      }

      saveTokens(accessToken, refreshToken)
      set({ accessToken, refreshToken, user: null, isAuthenticated: false, loading: true })

      try {
        const profile = await profileAPI()
        persistProfile(profile)
        set({ user: profile, isAuthenticated: true, loading: false })
      } catch (error) {
        removeTokens()
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, loading: false })
        throw toReadableAuthError(error, 'profile')
      }
    },

    logout: () => {
      purgeLocalCache(get().user?.uid)
      removeTokens()
      set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, loading: false })
    },

    checkAuth: async () => {
      if (get().isAuthenticated && get().user) {
        set({ loading: false })
        return
      }

      const { accessToken, refreshToken } = loadTokens()
      if (!accessToken) {
        set({ loading: false, isAuthenticated: false })
        return
      }

      set({ accessToken, refreshToken })

      // alova 拦截器已处理 401 → refresh → retry；这里成功拿到的就是归一化后的 UserProfile。
      try {
        const profile = await profileAPI()
        persistProfile(profile)
        set({ user: profile, isAuthenticated: true, loading: false })
      } catch {
        removeTokens()
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, loading: false })
      }
    },
  }
})

export default useAuthStore
