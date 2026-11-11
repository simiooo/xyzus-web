import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { App as AntdApp } from 'antd'
import { ArrowRight, Inbox, Star } from 'lucide-react'
import {
  oftenPlayedListAPI,
  starredSubscriptionListAPI,
  subscriptionListAPI,
  type SubscriptionLoadMoreKey,
  type SubscriptionParams,
} from '@/api/subscription'
import { enqueueOutbox } from '@/db/outbox'
import { CACHE_TTL, isFresh, readPage, writePage } from '@/db/cache'
import useAuthStore from '@/stores/authStore'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import PageHeader from '@/components/ui/PageHeader'
import SectionHead from '@/components/ui/SectionHead'
import SmartImage from '@/components/ui/SmartImage'
import EmptyState from '@/components/ui/EmptyState'
import PodcastRow from '@/components/rows/PodcastRow'
import SubscribeButton from '@/components/SubscribeButton'
import { EpisodeRowsSkeleton } from '@/components/ui/Skeleton'
import type { PodcastBasic } from '@/api/types'

type SubscriptionFilter = 'ALL' | 'STARRED'

const FILTER_TABS: { key: SubscriptionFilter; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'STARRED', label: '星标' },
]

/** `?filter=starred` 可直接打开星标 tab（截图 / 分享用） */
function readInitialFilter(): SubscriptionFilter {
  try {
    if (new URLSearchParams(window.location.search).get('filter') === 'starred') return 'STARRED'
  } catch {
    // 无 window 或参数非法时回落全部
  }
  return 'ALL'
}

/**
 * 我的订阅：标题 + 条数小字 + 「全部 / 星标」筛选 + 节目行（行尾星标、订阅状态）。
 * 自己列表里取消订阅会让行退出列表；别人的订阅列表只改状态不删行。
 * 「星标」tab 走 `/subscription_star`（xyz 已有端点，真实数据一次返回全部星标节目）。
 */
export default function Subscriptions() {
  const navigate = useNavigate()
  const { uid: urlUid } = useParams<{ uid?: string }>()
  const user = useAuthStore((s) => s.user)
  const { message } = AntdApp.useApp()

  const targetUid = urlUid || user?.uid
  const isOwn = !urlUid || urlUid === user?.uid

  const [filter, setFilter] = useState<SubscriptionFilter>(readInitialFilter)

  const [podcasts, setPodcasts] = useState<PodcastBasic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadMoreKey, setLoadMoreKey] = useState<SubscriptionLoadMoreKey | undefined>()
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const genRef = useRef(0)

  // 星标订阅（仅自己的页面；进入星标 tab 时加载）
  const [starred, setStarred] = useState<PodcastBasic[]>([])
  const [starredLoading, setStarredLoading] = useState(false)
  const [starredError, setStarredError] = useState(false)
  const [starReloadToken, setStarReloadToken] = useState(0)
  const [starringPid, setStarringPid] = useState<string | null>(null)

  // 常听节目（订阅页顶部货架，仅自己的订阅页；失败静默隐藏）
  const [oftenPlayed, setOftenPlayed] = useState<PodcastBasic[]>([])

  const loadFirst = useCallback(async (force = false) => {
    const gen = ++genRef.current
    const variant = targetUid || 'self'
    setError(null)
    setLoadMoreError(false)
    let hadCache = false
    if (!force) {
      const cached = await readPage<PodcastBasic[]>('subscriptionList', variant)
      if (gen !== genRef.current) return
      if (cached && Array.isArray(cached.payload) && cached.payload.length > 0) {
        hadCache = true
        setPodcasts(cached.payload)
        setLoadMoreKey(cached.loadMoreKey as SubscriptionLoadMoreKey | undefined)
        setLoading(false)
        if (isFresh(cached.fetchedAt, CACHE_TTL.subscriptionList)) return
      }
    }
    if (!hadCache) setLoading(true)
    try {
      const params: SubscriptionParams = {}
      if (targetUid) params.uid = targetUid
      const res = await subscriptionListAPI(params)
      if (gen !== genRef.current) return
      setPodcasts(res.items || [])
      setLoadMoreKey(res.loadMoreKey)
      void writePage('subscriptionList', variant, res.items || [], res.loadMoreKey)
    } catch {
      if (gen === genRef.current && !hadCache) {
        setPodcasts([])
        setError('订阅列表加载失败，请稍后重试。')
      }
    } finally {
      if (gen === genRef.current) setLoading(false)
    }
  }, [targetUid])

  useEffect(() => {
    // 不在 effect 体内同步 setState（react-hooks/set-state-in-effect）：推一个微任务再开始加载
    void Promise.resolve().then(() => loadFirst())
  }, [loadFirst])

  useEffect(() => {
    if (!isOwn) return
    let cancelled = false
    const load = async () => {
      try {
        const list = await oftenPlayedListAPI(5)
        if (!cancelled) setOftenPlayed(list.slice(0, 5))
      } catch {
        // 常听节目只是增强信息，失败不打扰页面
      }
    }
    void Promise.resolve().then(load)
    return () => {
      cancelled = true
    }
  }, [isOwn])

  useEffect(() => {
    if (!isOwn || filter !== 'STARRED') return
    let cancelled = false
    const load = async () => {
      setStarredLoading(true)
      setStarredError(false)
      try {
        const list = await starredSubscriptionListAPI()
        if (!cancelled) setStarred(list)
      } catch {
        if (!cancelled) {
          setStarred([])
          setStarredError(true)
        }
      } finally {
        if (!cancelled) setStarredLoading(false)
      }
    }
    void Promise.resolve().then(load)
    return () => {
      cancelled = true
    }
  }, [isOwn, filter, starReloadToken])

  const loadMore = useCallback(async () => {
    if (!loadMoreKey || loading || loadingMore) return
    const gen = genRef.current
    setLoadingMore(true)
    setLoadMoreError(false)
    try {
      const params: SubscriptionParams = { loadMoreKey }
      if (targetUid) params.uid = targetUid
      const res = await subscriptionListAPI(params)
      if (gen !== genRef.current) return
      setPodcasts((prev) => [...prev, ...(res.items || [])])
      setLoadMoreKey(res.loadMoreKey)
    } catch {
      if (gen === genRef.current) setLoadMoreError(true)
    } finally {
      if (gen === genRef.current) setLoadingMore(false)
    }
  }, [loadMoreKey, loading, loadingMore, targetUid])

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: filter === 'ALL' && Boolean(loadMoreKey) && !loading && !loadingMore && !loadMoreError,
  })

  const title = isOwn ? '我的订阅' : 'TA 的订阅'

  const headerActions = isOwn ? (
    <button type="button" className="pill pill-ghost" onClick={() => navigate('/following')}>
      关注动态
      <ArrowRight size={14} strokeWidth={2} />
    </button>
  ) : undefined

  /** 星标 / 取消星标：乐观更新两份列表，失败回滚 */
  const toggleStar = async (podcast: PodcastBasic) => {
    if (!isOwn || starringPid) return
    const next = !podcast.subscriptionStar
    const prevPodcasts = podcasts
    const prevStarred = starred
    const apply = (list: PodcastBasic[]) =>
      list.map((item) => (item.pid === podcast.pid ? { ...item, subscriptionStar: next } : item))

    setPodcasts(apply)
    setStarred((prev) => {
      if (!next) return prev.filter((item) => item.pid !== podcast.pid)
      if (prev.some((item) => item.pid === podcast.pid)) return apply(prev)
      return [...prev, { ...podcast, subscriptionStar: true }]
    })
    setStarringPid(podcast.pid)
    try {
      // 星标写入走 outbox：本地立即生效，网络失败后台重试
      await enqueueOutbox(
        'star_subscription',
        { pid: podcast.pid, withStar: next },
        podcast.pid,
      )
    } catch {
      setPodcasts(prevPodcasts)
      setStarred(prevStarred)
      message.error(next ? '星标失败，请重试' : '取消星标失败，请重试')
    } finally {
      setStarringPid(null)
    }
  }

  const renderRow = (podcast: PodcastBasic, index: number) => (
    <div key={podcast.pid} className={index > 0 ? 'dotted-top' : undefined}>
      <PodcastRow
        podcast={podcast}
        trailing={
          isOwn ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void toggleStar(podcast)}
                disabled={starringPid === podcast.pid}
                aria-label={podcast.subscriptionStar ? '取消星标' : '加星标'}
                aria-pressed={podcast.subscriptionStar}
                className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent transition-colors hover:bg-[var(--muted)]"
              >
                <Star
                  size={16}
                  strokeWidth={1.75}
                  fill={podcast.subscriptionStar ? 'currentColor' : 'none'}
                  style={{
                    color: podcast.subscriptionStar ? 'var(--accent-ink)' : 'var(--muted-foreground)',
                  }}
                />
              </button>
              <SubscribeButton
                podcast={podcast}
                onChange={(subscribed) => {
                  if (!subscribed) {
                    setPodcasts((prev) => prev.filter((item) => item.pid !== podcast.pid))
                    setStarred((prev) => prev.filter((item) => item.pid !== podcast.pid))
                  }
                }}
              />
            </div>
          ) : undefined
        }
      />
    </div>
  )

  const renderAll = () => {
    if (loading) return <EpisodeRowsSkeleton count={6} />
    if (error) {
      return (
        <div className="mt-4">
          <p className="m-0 type-sub">{error}</p>
          <button type="button" className="pill pill-ink mt-4" onClick={() => void loadFirst(true)}>
            重试
          </button>
        </div>
      )
    }
    if (podcasts.length === 0) {
      return (
        <EmptyState
          title={isOwn ? '还没有订阅节目' : '没有订阅节目'}
          hint={isOwn ? '去发现页找找喜欢的节目，订阅后会出现在这里。' : '对方可能没有公开自己的订阅。'}
          action={
            isOwn ? (
              <button type="button" className="pill pill-ink" onClick={() => navigate('/')}>
                <Inbox size={16} strokeWidth={1.75} />
                去发现
              </button>
            ) : undefined
          }
        />
      )
    }

    return (
      <>
        {isOwn && oftenPlayed.length > 0 && (
          <section className="mb-7">
            <SectionHead title="常听节目" level="section" />
            <div className="mt-3 flex gap-4 overflow-x-auto pb-1">
              {oftenPlayed.map((podcast) => (
                <button
                  key={podcast.pid}
                  type="button"
                  onClick={() => navigate(`/podcast/${podcast.pid}`)}
                  className="block w-[104px] flex-shrink-0 cursor-pointer border-0 bg-transparent p-0 text-left"
                >
                  <SmartImage
                    image={podcast.image}
                    aspectRatio={1}
                    rounded="lg"
                    className="h-[104px] w-[104px]"
                    alt={podcast.title}
                  />
                  <p className="m-0 mt-2 line-clamp-2 type-manage text-[var(--ink)]">{podcast.title}</p>
                  <p className="m-0 mt-0.5 truncate type-meta">{podcast.author}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="row-grid">{podcasts.map(renderRow)}</div>

        {loadingMore && (
          <div className="mt-2">
            <EpisodeRowsSkeleton count={1} />
          </div>
        )}

        {loadMoreError && (
          <div className="flex items-center gap-3 py-4">
            <p className="m-0 type-sub">加载更多订阅失败</p>
            <button type="button" className="pill" onClick={() => void loadMore()}>
              重试
            </button>
          </div>
        )}

        {loadMoreKey && !loadMoreError && <div ref={sentinelRef} className="h-px" aria-hidden />}
      </>
    )
  }

  const renderStarred = () => {
    if (starredLoading) return <EpisodeRowsSkeleton count={4} />
    if (starredError) {
      return (
        <div className="mt-4">
          <p className="m-0 type-sub">星标节目加载失败，请稍后重试。</p>
          <button
            type="button"
            className="pill pill-ink mt-4"
            onClick={() => setStarReloadToken((token) => token + 1)}
          >
            重试
          </button>
        </div>
      )
    }
    if (starred.length === 0) {
      return (
        <EmptyState
          title="还没有星标节目"
          hint="在订阅列表点星标，把最常听的节目放在这里。"
          action={
            <button type="button" className="pill pill-ink" onClick={() => setFilter('ALL')}>
              查看全部订阅
            </button>
          }
        />
      )
    }

    return <div className="row-grid">{starred.map(renderRow)}</div>
  }

  const aside = filter === 'STARRED' ? `${starred.length} 个节目` : `${podcasts.length} 个节目`

  return (
    <div>
      <PageHeader title={title} aside={loading && filter === 'ALL' ? undefined : aside} size="headline" actions={headerActions} />

      {isOwn && (
        <div role="tablist" aria-label="订阅筛选" className="mb-5 flex items-center gap-7 px-1">
          {FILTER_TABS.map((item) => {
            const selected = item.key === filter
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setFilter(item.key)}
                className="relative cursor-pointer border-0 bg-transparent p-0 pb-2 type-group transition-colors"
                style={{
                  color: selected ? 'var(--ink)' : 'var(--muted-foreground)',
                  fontWeight: 500,
                }}
              >
                {item.label}
                {selected && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--ink)]" />}
              </button>
            )
          })}
        </div>
      )}

      {isOwn && filter === 'STARRED' ? renderStarred() : renderAll()}
    </div>
  )
}
