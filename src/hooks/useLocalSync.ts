import { useEffect } from 'react'
import { pruneStaleCache } from '@/db/cache'
import { startOutboxAutoFlush } from '@/db/outbox'
import { startPlayedCacheSync } from '@/db/sync'
import useAuthStore from '@/stores/authStore'

/**
 * 本地缓存 / 写队列 / 增量同步的生命周期：
 * - 启动时跑一次过期缓存清理；
 * - 常驻 outbox 自动 flush；
 * - 最近收听增量同步（按账号重建：换号时拆旧装新并重新对账）；
 * - 不使用 React 状态，避免给页面增加订阅开销。
 */
export default function useLocalSync() {
  const userId = useAuthStore((s) => s.user?.uid)

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => {
      if (!cancelled) void pruneStaleCache()
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => startOutboxAutoFlush(), [])

  useEffect(() => startPlayedCacheSync(), [userId])
}
