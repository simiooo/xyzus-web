import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { App as AntdApp } from 'antd'
import { Inbox as InboxIcon } from 'lucide-react'
import { inboxListAPI, inboxRemoveAPI, type InboxLoadMoreKey } from '@/api/inbox'
import { noticeListAPI, type Notice, type NoticeLoadMoreKey } from '@/api/notice'
import NoticeRow from '@/components/notice/NoticeRow'
import NoticeRowsSkeleton from '@/components/notice/NoticeRowsSkeleton'
import useNotificationStore from '@/stores/notificationStore'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import PageHeader from '@/components/ui/PageHeader'
import SectionHead from '@/components/ui/SectionHead'
import EmptyState from '@/components/ui/EmptyState'
import EpisodeRow from '@/components/rows/EpisodeRow'
import { EpisodeRowsSkeleton } from '@/components/ui/Skeleton'
import { formatDate } from '@/utils/format'
import type { EpisodeBasic } from '@/api/types'

type MessageTab = 'notice' | 'inbox'

/** 文字页签：同字号只换墨色，选中下面一条与字同宽的 2px 墨色线（不用强调色） */
const TABS: { key: MessageTab; label: string }[] = [
  { key: 'notice', label: '通知' },
  { key: 'inbox', label: '收件箱' },
]

const TAB_ASIDE: Record<MessageTab, string> = {
  notice: '互动通知',
  inbox: '订阅更新',
}

interface InboxDayGroup {
  key: string
  label: string
  items: EpisodeBasic[]
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function dayLabel(isoDate: string, todayKey: string, yesterdayKey: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  const key = dayKey(date)
  if (key === todayKey) return '今天'
  if (key === yesterdayKey) return '昨天'
  return formatDate(date, { short: true })
}

/** 按发布日分组：今天 / 昨天 / 具体日期；组内保持接口返回的倒序 */
function groupByDay(items: EpisodeBasic[]): InboxDayGroup[] {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const todayKey = dayKey(today)
  const yesterdayKey = dayKey(yesterday)

  const groups: InboxDayGroup[] = []
  for (const item of items) {
    const date = new Date(item.pubDate)
    const key = Number.isNaN(date.getTime()) ? 'unknown' : dayKey(date)
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.items.push(item)
    } else {
      groups.push({
        key,
        label: dayLabel(item.pubDate, todayKey, yesterdayKey) || '更早',
        items: [item],
      })
    }
  }
  return groups
}

/** `?messageTab=inbox` 可直接预览收件箱 tab（截图/分享用）；默认通知 */
function readInitialMessageTab(): MessageTab {
  try {
    const raw = new URLSearchParams(window.location.search).get('messageTab')
    if (raw === 'inbox') return 'inbox'
  } catch {
    // 无 window 或参数非法时回落默认
  }
  return 'notice'
}

/**
 * 消息页：两个文字页签。
 * - 通知：别人对我的点赞 / 回复 / 关注（/notice_list，静态合同先行，结构未知也不崩）；
 * - 收件箱：订阅的节目更新（/inbox_list_v2），按发布日分组。
 * 两个 tab 各自维护分页状态，切换 tab 不会重新请求、也不丢已加载的数据。
 * 打开本页即把当前未读数记为已看（上游没有已读接口，见 notificationStore 注释）。
 */
export default function Inbox() {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const [tab, setTab] = useState<MessageTab>(readInitialMessageTab)

  // ---- 通知 tab 的分页状态（与收件箱互不影响） ----
  const [notices, setNotices] = useState<Notice[]>([])
  const [noticeLoading, setNoticeLoading] = useState(true)
  const [noticeError, setNoticeError] = useState<string | null>(null)
  const [noticeLoadMoreKey, setNoticeLoadMoreKey] = useState<NoticeLoadMoreKey | undefined>()
  const [noticeLoadingMore, setNoticeLoadingMore] = useState(false)
  const [noticeLoadMoreError, setNoticeLoadMoreError] = useState(false)
  const noticeGenRef = useRef(0)

  // ---- 收件箱 tab 的分页状态（保留原有逻辑） ----
  const [episodes, setEpisodes] = useState<EpisodeBasic[]>([])
  const [inboxLoading, setInboxLoading] = useState(true)
  const [inboxError, setInboxError] = useState<string | null>(null)
  const [inboxLoadMoreKey, setInboxLoadMoreKey] = useState<InboxLoadMoreKey | undefined>()
  const [inboxLoadingMore, setInboxLoadingMore] = useState(false)
  const [inboxLoadMoreError, setInboxLoadMoreError] = useState(false)
  const [removingAll, setRemovingAll] = useState(false)
  const inboxGenRef = useRef(0)
  const inboxRequestedRef = useRef(false)

  const loadNotices = useCallback(async () => {
    const gen = ++noticeGenRef.current
    setNoticeLoading(true)
    setNoticeError(null)
    setNoticeLoadMoreError(false)
    try {
      const page = await noticeListAPI()
      if (gen !== noticeGenRef.current) return
      setNotices(page.items || [])
      setNoticeLoadMoreKey(page.loadMoreKey)
    } catch {
      if (gen === noticeGenRef.current) {
        setNotices([])
        setNoticeError('通知加载失败，请稍后重试。')
      }
    } finally {
      if (gen === noticeGenRef.current) setNoticeLoading(false)
    }
  }, [])

  const loadMoreNotices = useCallback(async () => {
    if (!noticeLoadMoreKey || noticeLoading || noticeLoadingMore) return
    const gen = noticeGenRef.current
    setNoticeLoadingMore(true)
    setNoticeLoadMoreError(false)
    try {
      const page = await noticeListAPI({ loadMoreKey: noticeLoadMoreKey })
      if (gen !== noticeGenRef.current) return
      setNotices((prev) => [...prev, ...(page.items || [])])
      setNoticeLoadMoreKey(page.loadMoreKey)
    } catch {
      if (gen === noticeGenRef.current) setNoticeLoadMoreError(true)
    } finally {
      if (gen === noticeGenRef.current) setNoticeLoadingMore(false)
    }
  }, [noticeLoadMoreKey, noticeLoading, noticeLoadingMore])

  const noticeSentinelRef = useInfiniteScroll(loadMoreNotices, {
    enabled:
      tab === 'notice' &&
      Boolean(noticeLoadMoreKey) &&
      !noticeLoading &&
      !noticeLoadingMore &&
      !noticeLoadMoreError,
  })

  const loadInbox = useCallback(async () => {
    const gen = ++inboxGenRef.current
    setInboxLoading(true)
    setInboxError(null)
    setInboxLoadMoreError(false)
    try {
      const page = await inboxListAPI()
      if (gen !== inboxGenRef.current) return
      setEpisodes(page.items || [])
      setInboxLoadMoreKey(page.loadMoreKey)
    } catch {
      if (gen === inboxGenRef.current) {
        setEpisodes([])
        setInboxError('收件箱加载失败，请稍后重试。')
      }
    } finally {
      if (gen === inboxGenRef.current) setInboxLoading(false)
    }
  }, [])

  /** 收件箱在第一次切到该页签时才请求；之后再切回来复用已加载的数据 */
  const ensureInboxLoaded = useCallback(() => {
    if (inboxRequestedRef.current) return
    inboxRequestedRef.current = true
    void loadInbox()
  }, [loadInbox])

  const loadMoreInbox = useCallback(async () => {
    if (!inboxLoadMoreKey || inboxLoading || inboxLoadingMore) return
    const gen = inboxGenRef.current
    setInboxLoadingMore(true)
    setInboxLoadMoreError(false)
    try {
      const page = await inboxListAPI({ loadMoreKey: inboxLoadMoreKey })
      if (gen !== inboxGenRef.current) return
      setEpisodes((prev) => [...prev, ...(page.items || [])])
      setInboxLoadMoreKey(page.loadMoreKey)
    } catch {
      if (gen === inboxGenRef.current) setInboxLoadMoreError(true)
    } finally {
      if (gen === inboxGenRef.current) setInboxLoadingMore(false)
    }
  }, [inboxLoadMoreKey, inboxLoading, inboxLoadingMore])

  const inboxSentinelRef = useInfiniteScroll(loadMoreInbox, {
    enabled:
      tab === 'inbox' &&
      Boolean(inboxLoadMoreKey) &&
      !inboxLoading &&
      !inboxLoadingMore &&
      !inboxLoadMoreError,
  })

  /** 收件箱「全部已读」：App 的真实做法是把所有 eid 传给 /inbox_remove */
  const markInboxAllRead = useCallback(async () => {
    if (removingAll || inboxLoading || episodes.length === 0) return
    setRemovingAll(true)
    try {
      await inboxRemoveAPI(episodes.map((episode) => episode.eid))
      setEpisodes([])
      setInboxLoadMoreKey(undefined)
      setInboxLoadMoreError(false)
      void useNotificationStore.getState().refresh()
      message.success('收件箱已全部标为已读')
    } catch {
      message.error('全部已读失败，请稍后重试。')
    } finally {
      setRemovingAll(false)
    }
  }, [episodes, inboxLoading, message, removingAll])

  // 通知是默认页签：进页面就加载。不在 effect 体内同步 setState（react-hooks/set-state-in-effect）
  useEffect(() => {
    void Promise.resolve().then(() => loadNotices())
  }, [loadNotices])

  // 收件箱首次切到时才加载
  useEffect(() => {
    if (tab !== 'inbox') return
    void Promise.resolve().then(() => ensureInboxLoaded())
  }, [tab, ensureInboxLoaded])

  // 打开消息页 = 看过未读：先取一次最新未读数，再记本机已读水位（徽标随之隐藏）
  useEffect(() => {
    void Promise.resolve().then(async () => {
      await useNotificationStore.getState().refresh()
      useNotificationStore.getState().markAllSeen()
    })
  }, [])

  const groups = groupByDay(episodes)

  return (
    <div>
      <PageHeader title="消息" aside={TAB_ASIDE[tab]} size="headline" className="mb-4" />

      <div role="tablist" aria-label="消息分类" className="flex items-center gap-7">
        {TABS.map((item) => {
          const selected = item.key === tab
          return (
            <button
              key={item.key}
              id={`message-tab-${item.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`message-panel-${item.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.key)}
              className="relative cursor-pointer border-0 bg-transparent p-0 pb-2 type-group transition-colors"
              style={{
                color: selected ? 'var(--ink)' : 'var(--muted-foreground)',
                fontWeight: 500,
              }}
            >
              {item.label}
              {selected && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--ink)]"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* 通知 tab */}
      <div
        id="message-panel-notice"
        role="tabpanel"
        aria-labelledby="message-tab-notice"
        hidden={tab !== 'notice'}
        className="mt-5"
      >
        {noticeLoading ? (
          <NoticeRowsSkeleton count={6} />
        ) : noticeError ? (
          <div className="mt-2">
            <p className="m-0 type-sub">{noticeError}</p>
            <button type="button" className="pill pill-ink mt-4" onClick={() => void loadNotices()}>
              重试
            </button>
          </div>
        ) : notices.length === 0 ? (
          <EmptyState
            title="还没有新通知"
            hint="别人点赞、回复或关注你时，会出现在这里。"
          />
        ) : (
          <div>
            {notices.map((notice, index) => (
              <div key={notice.id} className={index > 0 ? 'dotted-top' : undefined}>
                <NoticeRow notice={notice} />
              </div>
            ))}

            {noticeLoadingMore && (
              <div className="mt-1">
                <NoticeRowsSkeleton count={2} />
              </div>
            )}

            {noticeLoadMoreError && (
              <div className="flex items-center gap-3 py-4">
                <p className="m-0 type-sub">加载更多通知失败</p>
                <button type="button" className="pill" onClick={() => void loadMoreNotices()}>
                  重试
                </button>
              </div>
            )}

            {noticeLoadMoreKey && !noticeLoadMoreError && (
              <div ref={noticeSentinelRef} className="h-px" aria-hidden />
            )}
          </div>
        )}
      </div>

      {/* 收件箱 tab */}
      <div
        id="message-panel-inbox"
        role="tabpanel"
        aria-labelledby="message-tab-inbox"
        hidden={tab !== 'inbox'}
        className="mt-5"
      >
        {inboxLoading ? (
          <EpisodeRowsSkeleton count={6} />
        ) : inboxError ? (
          <div className="mt-2">
            <p className="m-0 type-sub">{inboxError}</p>
            <button type="button" className="pill pill-ink mt-4" onClick={() => void loadInbox()}>
              重试
            </button>
          </div>
        ) : episodes.length === 0 ? (
          <EmptyState
            title="收件箱还没有更新"
            hint="订阅喜欢的节目后，新单集会按时间出现在这里。"
            action={
              <button
                type="button"
                className="pill pill-ink"
                onClick={() => navigate('/subscriptions')}
              >
                <InboxIcon size={16} strokeWidth={1.75} />
                查看我的订阅
              </button>
            }
          />
        ) : (
          <div>
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                className="pill"
                disabled={removingAll}
                onClick={() => void markInboxAllRead()}
              >
                {removingAll ? '处理中…' : '全部标为已读'}
              </button>
            </div>
            <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.key}>
                <SectionHead level="section" title={group.label} className="mb-1" />
                <div>
                  {group.items.map((episode, index) => (
                    <div key={episode.eid} className={index > 0 ? 'dotted-top' : undefined}>
                      <EpisodeRow episode={episode} showPodcast dateStyle="none" />
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {inboxLoadingMore && (
              <div>
                <EpisodeRowsSkeleton count={2} />
              </div>
            )}

            {inboxLoadMoreError && (
              <div className="flex items-center gap-3 py-4">
                <p className="m-0 type-sub">加载更多更新失败</p>
                <button type="button" className="pill" onClick={() => void loadMoreInbox()}>
                  重试
                </button>
              </div>
            )}

            {inboxLoadMoreKey && !inboxLoadMoreError && (
              <div ref={inboxSentinelRef} className="h-px" aria-hidden />
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
