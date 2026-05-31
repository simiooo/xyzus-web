import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Spin } from 'antd'
import useAuthStore from '@/stores/authStore'

export default function AuthGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { isAuthenticated, loading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', { replace: true })
    }
  }, [loading, isAuthenticated, navigate])

  useEffect(() => {
    const handler = () => {
      navigate('/login', { replace: true })
    }
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [navigate])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return <>{children}</>
}
