import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import useAuthStore from '@/stores/authStore'
import ShellSkeleton from '@/components/shell/ShellSkeleton'

/**
 * 登录守卫。启动校验期间显示骨架（而不是整屏转圈），
 * 失效时清路由并跳登录页；其它地方广播的 auth:expired 也走同一条路。
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const loading = useAuthStore((s) => s.loading)
  const checkAuth = useAuthStore((s) => s.checkAuth)

  useEffect(() => {
    // 离线 mock 模式：种一个假 token，让 /profile 走 mock 直接拿到用户，
    // 这样没有真实后端也能查看所有页面。真实模式下这段不执行。
    if (typeof window !== 'undefined' && window.__XYZ_MOCK_ENABLED__) {
      try {
        if (!localStorage.getItem('x-jike-access-token')) {
          localStorage.setItem('x-jike-access-token', 'mock-access-token')
          localStorage.setItem('x-jike-refresh-token', 'mock-refresh-token')
        }
      } catch {
        // 存不下就退回未登录
      }
    }
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', { replace: true })
    }
  }, [loading, isAuthenticated, navigate])

  useEffect(() => {
    const handler = () => navigate('/login', { replace: true })
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [navigate])

  if (loading) {
    return <ShellSkeleton />
  }

  if (!isAuthenticated) return null

  return <>{children}</>
}
