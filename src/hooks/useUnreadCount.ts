import { useEffect } from 'react'
import useAuthStore from '@/stores/authStore'
import useNotificationStore from '@/stores/notificationStore'

/** 未读数轮询间隔：进入应用先取一次，之后窗口聚焦、切回标签页、定时都会刷新 */
const REFRESH_INTERVAL = 120_000

/**
 * 未读数轮询。挂在 Layout 上（登录后才有意义）。
 * 没有 WebSocket / 推送，靠「聚焦 + 定时」保持徽标大致新鲜。
 */
export function useUnreadCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return

    const sync = async () => {
      await useNotificationStore.getState().refresh()
      // 正在收件箱页：刷新后继续保持「已看」，避免徽标在用户眼前闪出来
      if (window.location.pathname.startsWith('/inbox')) {
        useNotificationStore.getState().markAllSeen()
      }
    }

    void sync()
    const timer = window.setInterval(() => void sync(), REFRESH_INTERVAL)
    const onFocus = () => void sync()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void sync()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isAuthenticated])
}

export default useUnreadCount
