import { create } from 'zustand'
import { initAlovaDeps, refreshTokens } from '@/alova'
import {
  sendCodeAPI,
  loginAPI,
  profileAPI,
} from '@/api/auth'
import type { UserProfile } from '@/api/types'

function loadTokens(): { accessToken: string | null; refreshToken: string | null } {
  try {
    return {
      accessToken: localStorage.getItem('x-jike-access-token'),
      refreshToken: localStorage.getItem('x-jike-refresh-token'),
    }
  } catch {
    return { accessToken: null, refreshToken: null }
  }
}

function saveTokens(access: string, refresh: string) {
  localStorage.setItem('x-jike-access-token', access)
  localStorage.setItem('x-jike-refresh-token', refresh)
}

function removeTokens() {
  localStorage.removeItem('x-jike-access-token')
  localStorage.removeItem('x-jike-refresh-token')
  localStorage.removeItem('x-jike-user-profile')
}

function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem('x-jike-user-profile')
    return raw ? (JSON.parse(raw) as UserProfile) : null
  } catch {
    return null
  }
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserProfile | null
  isAuthenticated: boolean
  loading: boolean
  login: (phone: string, code: string, areaCode: string) => Promise<void>
  sendCode: (phone: string, areaCode: string) => Promise<void>
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
      removeTokens()
      set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false })
    },
  )

  const tokens = loadTokens()

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: loadProfile(),
    isAuthenticated: false,
    loading: true,

    login: async (phone: string, code: string, areaCode: string) => {
      const data = await loginAPI({ mobilePhoneNumber: phone, verifyCode: code, areaCode })
      const access = data['x-jike-access-token']
      const refresh = data['x-jike-refresh-token']
      saveTokens(access, refresh)
      set({ accessToken: access, refreshToken: refresh })

      const profile = (data as unknown as { data: UserProfile }).data
      localStorage.setItem('x-jike-user-profile', JSON.stringify(profile))
      set({ user: profile, isAuthenticated: true, loading: false })
    },

    sendCode: async (phone: string, areaCode: string) => {
      await sendCodeAPI({ mobilePhoneNumber: phone, areaCode })
    },

    logout: () => {
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

      try {
        const result = await profileAPI()
        const profile = (result as unknown as { data: UserProfile }).data
        localStorage.setItem('x-jike-user-profile', JSON.stringify(profile))
        set({ user: profile, isAuthenticated: true, loading: false })
      } catch {
        const refreshed = await refreshTokens(
          () => loadTokens(),
          (access, refresh) => {
            saveTokens(access, refresh)
            set({ accessToken: access, refreshToken: refresh })
          },
          () => {
            removeTokens()
            set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, loading: false })
          },
        )
        if (refreshed) {
          try {
            const result = await profileAPI()
            const profile = (result as unknown as { data: UserProfile }).data
            localStorage.setItem('x-jike-user-profile', JSON.stringify(profile))
            set({ user: profile, isAuthenticated: true, loading: false })
          } catch {
            removeTokens()
            set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, loading: false })
          }
        } else {
          removeTokens()
          set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, loading: false })
        }
      }
    },
  }
})

export default useAuthStore
