import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { episodeListAPI, podcastDetailAPI, podcastRelatedAPI } from '@/api/podcast'
import { CACHE_TTL, isFresh, readEntity, writeEntity } from '@/db/cache'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import useAudioStore from '@/stores/audioStore'
import SmartImage from '@/components/ui/SmartImage'
import SectionHead from '@/components/ui/SectionHead'
import EmptyState from '@/components/ui/EmptyState'
import PlayButton from '@/components/ui/PlayButton'
import SubscribeButton from '@/components/SubscribeButton'
import EpisodeRow from '@/components/rows/EpisodeRow'
import PodcastTile from '@/components/rows/PodcastTile'
import { DetailSkeleton, EpisodeRowsSkeleton } from '@/components/ui/Skeleton'
import { formatCount, formatDate } from '@/utils/format'
import type { CursorKey, EpisodeBasic, PodcastBasic, PodcastRelatedItem } from '@/api/types'

type EpisodeOrder = 'asc' | 'desc'

/** 把接口错误翻成一句能读的中文（接口层承诺其 message 是中文） */
function readableError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message.trim() : ''
  if (!raw) return fallback
  if (raw.length > 60) return fallback
  if (!/[\u4e00-\u9fa5]/.test(raw)) return fallback
  return raw
}

/**
 * 节目详情：媒体头（封面 + 标题 + 元信息）→ 播放/订阅模块 → 节目简介
 * → 相关节目 → 单集列表。
 * 版式与单集页一致：主操作单独成块，正文不包卡片，板块之间用点线分隔。
 */
export default function PodcastDetail() {
  const { pid } = useParams<{ pid: string }>()

  const [podcast, setPodcast] = useState<PodcastBasic | null>(null)
  const [related, setRelated] = useState<PodcastBasic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [introExpanded, setIntroExpanded] = useState(false)

  const [episodes, setEpisodes] = useState<EpisodeBasic[]>([])
  const [episodesLoading, setEpisodesLoading] = useState(true)
  const [episodesError, setEpisodesError] = useState(false)
  const [order, setOrder] = useState<EpisodeOrder>('desc')
  const [loadMoreKey, setLoadMoreKey] = useState<CursorKey | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const episodesGenRef = useRef(0)

  const loadMain = useCallback(async (force = false) => {
    if (!pid) {
      setError('找不到这个节目。')
      setLoading(false)
      return
    }
    setError(null)
    let hadCache = false
    if (!force) {
      const cached = await readEntity<{ podcast: PodcastBasic; related: PodcastBasic[] }>(
        'podcastBundle',
        pid,
      )
      if (cached) {
        hadCache = true
        setPodcast(cached.data.podcast)
        setRelated(cached.data.related || [])
        setLoading(false)
        if (isFresh(cached.fetchedAt, CACHE_TTL.podcastDetail)) return
      }
    }
    if (!hadCache) setLoading(true)
    try {
      const [detailResult, relatedResult] = await Promise.allSettled([
        podcastDetailAPI(pid),
        podcastRelatedAPI({ pid }),
      ])
      if (detailResult.status === 'fulfilled') {
        setPodcast(detailResult.value)
        let relatedPodcasts: PodcastBasic[] = []
        if (relatedResult.status === 'fulfilled') {
          const items: PodcastRelatedItem[] = relatedResult.value || []
          relatedPodcasts = items.map((item) => item.podcast).filter(Boolean)
          setRelated(relatedPodcasts)
        } else {
          setRelated([])
        }
        void writeEntity('podcastBundle', pid, { podcast: detailResult.value, related: relatedPodcasts })
      } else if (!hadCache) {
        setPodcast(null)
        setError(readableError(detailResult.reason, '节目加载失败，请稍后重试。'))
      }
    } finally {
      setLoading(false)
    }
  }, [pid])

  useEffect(() => {
    // 不在 effect 体内同步 setState（react-hooks/set-state-in-effect）：推一个微任务再开始加载
    void Promise.resolve().then(() => loadMain())
  }, [loadMain])

  const loadEpisodes = useCallback(
    async (nextOrder: EpisodeOrder) => {
      if (!pid) return
      const gen = ++episodesGenRef.current
      setEpisodesLoading(true)
      setEpisodesError(false)
      setLoadMoreError(false)
      setEpisodes([])
      setLoadMoreKey(undefined)
      setHasMore(false)
      try {
        const res = await episodeListAPI({ pid, order: nextOrder })
        if (gen !== episodesGenRef.current) return
        setEpisodes(res.items || [])
        setLoadMoreKey(res.loadMoreKey)
        setHasMore(Boolean(res.loadMoreKey))
      } catch {
        if (gen === episodesGenRef.current) setEpisodesError(true)
      } finally {
        if (gen === episodesGenRef.current) setEpisodesLoading(false)
      }
    },
    [pid],
  )

  useEffect(() => {
    void Promise.resolve().then(() => loadEpisodes(order))
  }, [order, loadEpisodes])

  const loadMoreEpisodes = useCallback(async () => {
    if (!pid || !loadMoreKey || episodesLoading || loadingMore) return
    const gen = episodesGenRef.current
    setLoadingMore(true)
    setLoadMoreError(false)
    try {
      const res = await episodeListAPI({ pid, order, loadMoreKey })
      if (gen !== episodesGenRef.current) return
      setEpisodes((prev) => [...prev, ...(res.items || [])])
      setLoadMoreKey(res.loadMoreKey)
      setHasMore(Boolean(res.loadMoreKey))
    } catch {
      if (gen === episodesGenRef.current) setLoadMoreError(true)
    } finally {
      if (gen === episodesGenRef.current) setLoadingMore(false)
    }
  }, [pid, order, loadMoreKey, episodesLoading, loadingMore])

  const episodesSentinelRef = useInfiniteScroll(loadMoreEpisodes, {
    enabled: hasMore && !episodesLoading && !loadingMore && !loadMoreError,
  })

  const handleSubscribeChange = (subscribed: boolean) => {
    setPodcast((prev) =>
      prev
        ? {
            ...prev,
            subscriptionStatus: subscribed ? 'ON' : 'OFF',
            subscriptionCount: Math.max(0, prev.subscriptionCount + (subscribed ? 1 : -1)),
          }
        : prev,
    )
  }

  const intro = podcast?.description || podcast?.brief || ''
  const canExpandIntro = intro.length > 120

  const currentEpisode = useAudioStore((s) => s.currentEpisode)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const play = useAudioStore((s) => s.play)
  const togglePlay = useAudioStore((s) => s.togglePlay)

  // 最新一集：列表按 desc 时是第一条，按 asc 时是最后一条
  const latestEpisode =
    episodes.length === 0 ? null : order === 'desc' ? episodes[0] : episodes[episodes.length - 1]
  const isLatestCurrent = Boolean(latestEpisode) && currentEpisode?.eid === latestEpisode?.eid

  const handlePlayLatest = () => {
    if (!latestEpisode) return
    if (isLatestCurrent) togglePlay()
    else play(latestEpisode)
  }

  // 播放模块滚出视口后，顶部浮出迷你播放条（与单集页同一套行为）
  const moduleRef = useRef<HTMLDivElement>(null)
  const [miniPlayer, setMiniPlayer] = useState(false)

  useEffect(() => {
    const node = moduleRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setMiniPlayer(!entry.isIntersecting)
      },
      { threshold: 0, rootMargin: '-72px 0px 0px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [podcast?.pid])

  return (
    <div>
      <BackButton />

      {loading ? (
        <DetailSkeleton />
      ) : error || !podcast ? (
        <div className="mt-2">
          <p className="m-0 type-title text-[var(--ink)]">节目加载失败</p>
          <p className="m-0 mt-1.5 type-sub">{error}</p>
          <button type="button" className="pill pill-ink mt-5" onClick={() => void loadMain(true)}>
            重试
          </button>
        </div>
      ) : (
        <div>
          {/* 媒体头：封面 + 标题 + 元信息，和单集页同一套排版 */}
          <div className="mt-1 flex items-start gap-4 sm:gap-5">
            <SmartImage
              image={podcast.image}
              aspectRatio={1}
              rounded="lg"
              priority
              className="h-[104px] w-[104px] flex-shrink-0 sm:h-[124px] sm:w-[124px]"
              alt={podcast.title}
            />
            <div className="min-w-0 flex-1">
              <h1 className="m-0 type-headline text-[var(--ink)]">{podcast.title}</h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 type-meta">
                {podcast.author && <span>{podcast.author}</span>}
                {podcast.author && <span aria-hidden>·</span>}
                <span className="tabnum">{formatCount(podcast.subscriptionCount)} 人订阅</span>
                <span aria-hidden>·</span>
                <span className="tabnum">{podcast.episodeCount} 集</span>
                {podcast.latestEpisodePubDate && (
                  <>
                    <span aria-hidden>·</span>
                    <span>最近更新 {formatDate(podcast.latestEpisodePubDate)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 播放/订阅模块：主操作单独一块，不和应用其它内容混排 */}
          <div ref={moduleRef} className="mt-6 flex flex-wrap items-center gap-4">
            {latestEpisode ? (
              <>
                <PlayButton
                  size="lg"
                  variant="accent"
                  playing={isLatestCurrent && isPlaying}
                  onClick={handlePlayLatest}
                  label="播放最新一集"
                />
                <div className="min-w-0 flex-1">
                  <p className="m-0 type-row-title text-[var(--ink)]">播放最新一集</p>
                  <p className="m-0 mt-0.5 truncate type-meta">{latestEpisode.title}</p>
                </div>
              </>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="m-0 type-row-title text-[var(--ink)]">
                  {episodesLoading ? '正在载入单集…' : '还没有可播放的单集'}
                </p>
              </div>
            )}
            <div className="flex-shrink-0">
              <SubscribeButton podcast={podcast} onChange={handleSubscribeChange} />
            </div>
          </div>

          {/* 滚过播放模块后：顶部浮出迷你播放条；本集正在播放时交给底部播放条 */}
          {miniPlayer && latestEpisode && !isLatestCurrent && (
            <div className="pointer-events-none fixed inset-x-0 top-16 z-20 lg:top-0">
              <div className="mx-auto w-full max-w-[var(--shell-max)] px-4 lg:px-5">
                <div className="pointer-events-auto flex items-center gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_97%,transparent)] py-2.5 backdrop-blur-md lg:ml-[var(--rail)] xl:mr-[var(--right-w)]">
                  <SmartImage
                    image={podcast.image}
                    aspectRatio={1}
                    rounded="sm"
                    className="h-9 w-9 flex-shrink-0"
                    alt={podcast.title}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate type-row-title text-[var(--ink)]">{podcast.title}</p>
                    <p className="m-0 truncate type-meta">播放最新一集 · {latestEpisode.title}</p>
                  </div>
                  <PlayButton
                    size="md"
                    variant="accent"
                    playing={isLatestCurrent && isPlaying}
                    onClick={handlePlayLatest}
                    label="播放最新一集"
                  />
                </div>
              </div>
            </div>
          )}

          {intro && (
            <section className="mt-8">
              <SectionHead title="节目简介" level="section" />
              <p
                className={`m-0 mt-2 type-body-lg text-[var(--ink-soft)] ${
                  introExpanded ? 'whitespace-pre-wrap' : 'line-clamp-3'
                }`}
              >
                {intro}
              </p>
              {canExpandIntro && (
                <button
                  type="button"
                  onClick={() => setIntroExpanded((value) => !value)}
                  className="-ml-2 mt-1 inline-flex h-8 items-center rounded-full border-0 bg-transparent px-2 type-manage text-[var(--accent-ink)] transition-colors hover:bg-[var(--muted)] cursor-pointer"
                >
                  {introExpanded ? '收起' : '展开全文'}
                </button>
              )}
            </section>
          )}

          {related.length > 0 && (
            <section className="dotted-top mt-8 pt-8">
              <SectionHead title="相关节目" level="title" />
              <div className="shelf mt-4 pb-1">
                {related.map((item) => (
                  <PodcastTile key={item.pid} podcast={item} />
                ))}
              </div>
            </section>
          )}

          <section className="dotted-top mt-10 pb-4 pt-8">
            <SectionHead
              title={order === 'desc' ? '最新单集' : '最早单集'}
              aside={podcast.episodeCount > 0 ? `${podcast.episodeCount} 集` : undefined}
              level="title"
              action={
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="pill"
                    data-selected={order === 'desc'}
                    aria-pressed={order === 'desc'}
                    onClick={() => setOrder('desc')}
                  >
                    最新在前
                  </button>
                  <button
                    type="button"
                    className="pill"
                    data-selected={order === 'asc'}
                    aria-pressed={order === 'asc'}
                    onClick={() => setOrder('asc')}
                  >
                    最早在前
                  </button>
                </div>
              }
            />

            {episodesLoading ? (
              <div className="mt-3">
                <EpisodeRowsSkeleton count={6} />
              </div>
            ) : episodesError ? (
              <div className="mt-2 py-8">
                <p className="m-0 type-sub">单集加载失败，可能是网络不稳定。</p>
                <button
                  type="button"
                  className="pill pill-ink mt-4"
                  onClick={() => void loadEpisodes(order)}
                >
                  重试
                </button>
              </div>
            ) : episodes.length === 0 ? (
              <EmptyState title="还没有单集" hint="这个节目可能还在筹备中，稍后再来看看。" className="mt-2" />
            ) : (
              <div className="dotted-rows mt-2">
                {episodes.map((episode) => (
                  <EpisodeRow key={episode.eid} episode={episode} showPodcast={false} />
                ))}

                {loadingMore && (
                  <div className="mt-2">
                    <EpisodeRowsSkeleton count={1} />
                  </div>
                )}

                {loadMoreError && (
                  <div className="flex items-center gap-3 py-4">
                    <p className="m-0 type-sub">加载更多单集失败</p>
                    <button type="button" className="pill" onClick={() => void loadMoreEpisodes()}>
                      重试
                    </button>
                  </div>
                )}

                {hasMore && !loadMoreError && (
                  <div ref={episodesSentinelRef} className="h-px" aria-hidden />
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function BackButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="-ml-2 mb-3 inline-flex h-8 items-center gap-1.5 rounded-full border-0 bg-transparent px-2 type-sub text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
    >
      <ArrowLeft size={14} strokeWidth={1.75} />
      返回
    </button>
  )
}
