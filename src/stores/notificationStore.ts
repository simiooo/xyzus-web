import { create } from 'zustand'
import { unreadCountAPI } from '@/api/inbox'

/**
 * 未读消息状态。
 *
 * 上游/后端没有「标记已读」接口（xyz 只代理了 `/unread_count` 一个数字），所以服务端
 * 未读数不会自己变少。这里用一条**本机已读水位线**（seenCount，写 localStorage）决定
 * 徽标是否显示：只有服务端未读数超过本机看过的水位时才亮。打开收件箱 = 把当前未读数
 * 记为已看；服务端之后的增量仍会重新亮徽标。
 */
const SEEN_COUNT_KEY = 'xyz:notification-seen-count'

/** 同一时刻只发一个未读数请求（Layout 轮询与收件箱页会同时触发） */
let inflight: Promise<number> | null = null

function readSeenCount(): number {
  try {
    const raw = localStorage.getItem(SEEN_COUNT_KEY)
    if (raw === null) return 0
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
  } catch {
    return 0
  }
}

function writeSeenCount(count: number) {
  try {
    localStorage.setItem(SEEN_COUNT_KEY, String(count))
  } catch {
    // 存不下只影响跨会话的已读水位，不影响当前会话
  }
}

interface NotificationState {
  /** 服务端报告的未读消息数（只有数量，没有内容） */
  unreadCount: number
  /** 本机看过收件箱时的未读水位；≥ unreadCount 时不显示徽标 */
  seenCount: number
  /** 还没拿到过未读数就打开了消息页：下一次成功取到数字时直接记为已看 */
  seenPending: boolean
  loading: boolean
  /** 最近一次成功拿到未读数的时间；null 表示还没成功过（失败时不要记已看） */
  lastFetchedAt: number | null
  refresh: () => Promise<number>
  markAllSeen: () => void
}

const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  seenCount: readSeenCount(),
  seenPending: false,
  loading: false,
  lastFetchedAt: null,

  refresh: () => {
    if (inflight) return inflight

    inflight = (async () => {
      set({ loading: true })
      try {
        const count = await unreadCountAPI()
        set({ unreadCount: count, loading: false, lastFetchedAt: Date.now() })
        if (get().seenPending) {
          writeSeenCount(count)
          set({ seenCount: count, seenPending: false })
        }
        return count
      } catch {
        // 未读数不是关键路径：失败静默，等下一次轮询/聚焦再试
        set({ loading: false })
        return get().unreadCount
      } finally {
        inflight = null
      }
    })()

    return inflight
  },

  markAllSeen: () => {
    const { unreadCount, seenCount, lastFetchedAt } = get()
    if (lastFetchedAt === null) {
      // 未读数还没成功取到过：等下一次成功再记，避免把「没数据」当成「已读」
      set({ seenPending: true })
      return
    }
    const next = Math.max(unreadCount, seenCount)
    writeSeenCount(next)
    set({ seenCount: next, seenPending: false })
  },
}))

export default useNotificationStore
