import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { App as AntdApp } from 'antd'
import { ArrowLeft, Link2 } from 'lucide-react'
import DOMPurify from 'dompurify'
import {
  episodeAISummaryAPI,
  episodeDetailAPI,
  episodeTranscriptAPI,
  episodeTranscriptContentAPI,
  relatedEpisodeListAPI,
  type EpisodeAISummary,
  type EpisodeTranscriptMeta,
  type TranscriptSegment,
} from '@/api/episode'
import CommentItem from '@/components/comments/CommentItem'
import { commentCreateAPI, commentGetAPI, commentPrimaryAPI, commentTimestampPrimaryAPI } from '@/api/comment'
import { CACHE_TTL, isFresh, readEntity, writeEntity } from '@/db/cache'
import useAuthStore from '@/stores/authStore'
import useAudioStore from '@/stores/audioStore'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import SmartImage from '@/components/ui/SmartImage'
import PlayButton from '@/components/ui/PlayButton'
import FavoriteButton from '@/components/FavoriteButton'
import WaveSeekbar from '@/components/ui/WaveSeekbar'
import SectionHead from '@/components/ui/SectionHead'
import EmptyState from '@/components/ui/EmptyState'
import EpisodeRow from '@/components/rows/EpisodeRow'
import { EpisodeRowsSkeleton, SkeletonBox } from '@/components/ui/Skeleton'
import {
  formatCount,
  formatDate,
  formatDuration,
  formatDurationShort,
  formatPlayCount,
} from '@/utils/format'
import type {
  Comment as CommentType,
  CommentPrimaryLoadMoreKey,
  EpisodeBasic,
  EpisodeDetail as EpisodeDetailType,
} from '@/api/types'

type CommentOrder = 'HOT' | 'TIME' | 'TIMESTAMP'

const COMMENT_ORDER_TABS: { key: CommentOrder; label: string }[] = [
  { key: 'HOT', label: '热门' },
  { key: 'TIME', label: '最新' },
  { key: 'TIMESTAMP', label: '时点' },
]

/** `?commentOrder=TIMESTAMP` 直接打开时点评论（截图 / 分享用） */
function readInitialCommentOrder(): CommentOrder {
  try {
    if (new URLSearchParams(window.location.search).get('commentOrder') === 'TIMESTAMP') return 'TIMESTAMP'
  } catch {
    // 无 window 或参数非法时回落热门
  }
  return 'HOT'
}

const SHOWNOTES_PURIFY_OPTIONS = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target', 'rel'],
}

/** 把接口错误翻成一句能读的中文（接口层承诺其 message 是中文） */
function readableError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message.trim() : ''
  if (!raw) return fallback
  if (raw.length > 60) return fallback
  if (!/[\u4e00-\u9fa5]/.test(raw)) return fallback
  return raw
}

/**
 * 单集详情：阅读页。阅读列 720px、严格左对齐。
 * 阅读顺序是「节目 → 标题 → 元信息 → 播放/收藏/分享 → 正文 → 评论」，
 * 强调色只出现在播放按钮与播放进度上。
 */
export default function EpisodeDetail() {
  const { eid } = useParams<{ eid: string }>()
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()

  const currentUserId = useAuthStore((s) => s.user?.uid)
  const currentUser = useAuthStore((s) => s.user)

  const currentEpisode = useAudioStore((s) => s.currentEpisode)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const audioLoading = useAudioStore((s) => s.isLoading)
  const currentTime = useAudioStore((s) => s.currentTime)
  const audioDuration = useAudioStore((s) => s.duration)
  const play = useAudioStore((s) => s.play)
  const togglePlay = useAudioStore((s) => s.togglePlay)
  const seekTo = useAudioStore((s) => s.seekTo)

  const [episode, setEpisode] = useState<EpisodeDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // AI 摘要 / 文字稿（/ai_summary_episode_retrieve_brief、/episode_transcript_get）
  const [aiSummary, setAiSummary] = useState<EpisodeAISummary | null>(null)
  const [transcriptMeta, setTranscriptMeta] = useState<EpisodeTranscriptMeta | null>(null)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[] | null>(null)
  const [transcriptLoading, setTranscriptLoading] = useState(false)
  const [transcriptError, setTranscriptError] = useState(false)
  const [transcriptReloadToken, setTranscriptReloadToken] = useState(0)
  const transcriptMediaId = episode?.transcriptMediaId || episode?.transcript?.mediaId || ''

  // 相关单集推荐（/related_episode_list，真实抓包：body {eid} → {data: Episode[]}）
  const [relatedEpisodes, setRelatedEpisodes] = useState<EpisodeBasic[]>([])
  const [relatedLoading, setRelatedLoading] = useState(true)
  const [relatedError, setRelatedError] = useState(false)
  const [relatedReloadToken, setRelatedReloadToken] = useState(0)

  const [commentOrder, setCommentOrder] = useState<CommentOrder>(readInitialCommentOrder)
  const [comments, setComments] = useState<CommentType[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentsError, setCommentsError] = useState(false)
  const [commentLoadMoreKey, setCommentLoadMoreKey] = useState<CommentPrimaryLoadMoreKey | undefined>()
  const [commentsHasMore, setCommentsHasMore] = useState(false)
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false)
  const [commentsLoadMoreError, setCommentsLoadMoreError] = useState(false)
  const commentsGenRef = useRef(0)

  // 时点评论（TIMESTAMP tab）：标记接口按 120s 窗口返回 {id,timestamp,type}，再用 comment_get 逐条取正文
  const [timepointFrom, setTimepointFrom] = useState(0)
  const [timepointItems, setTimepointItems] = useState<{ timestamp: number; comment: CommentType }[]>([])
  const [timepointLoading, setTimepointLoading] = useState(false)
  const [timepointError, setTimepointError] = useState(false)
  const [timepointReloadToken, setTimepointReloadToken] = useState(0)
  const TIMEPOINT_WINDOW = 120

  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const postLockRef = useRef(false)

  const loadEpisode = useCallback(async (force = false) => {
    if (!eid) {
      setError('找不到这个单集。')
      setLoading(false)
      return
    }
    setError(null)
    let hadCache = false
    if (!force) {
      const cached = await readEntity<EpisodeDetailType>('episode', eid)
      if (cached) {
        hadCache = true
        setEpisode(cached.data)
        setLoading(false)
        if (isFresh(cached.fetchedAt, CACHE_TTL.episodeDetail)) return
      }
    }
    if (!hadCache) setLoading(true)
    try {
      const data = await episodeDetailAPI({ eid })
      setEpisode(data)
      void writeEntity('episode', eid, data)
    } catch (err) {
      // 有缓存时后台刷新失败不打断阅读，只保留旧内容
      if (!hadCache) setError(readableError(err, '单集加载失败，请稍后重试。'))
    } finally {
      setLoading(false)
    }
  }, [eid])

  useEffect(() => {
    // 不在 effect 体内同步 setState（react-hooks/set-state-in-effect）：推一个微任务再开始加载
    void Promise.resolve().then(() => loadEpisode())
  }, [loadEpisode])

  useEffect(() => {
    if (!eid) return
    let cancelled = false
    const loadRelated = async () => {
      setRelatedLoading(true)
      setRelatedError(false)
      try {
        const list = await relatedEpisodeListAPI(eid)
        if (!cancelled) setRelatedEpisodes(list)
      } catch {
        if (!cancelled) {
          setRelatedEpisodes([])
          setRelatedError(true)
        }
      } finally {
        if (!cancelled) setRelatedLoading(false)
      }
    }
    // 不在 effect 体内同步 setState（react-hooks/set-state-in-effect）：推一个微任务再开始加载
    void Promise.resolve().then(loadRelated)
    return () => {
      cancelled = true
    }
  }, [eid, relatedReloadToken])

  // AI 摘要：不是每集都有、上游还会 429；失败就静默降级，不打扰页面
  useEffect(() => {
    if (!eid) return
    let cancelled = false
    const loadSummary = async () => {
      try {
        const summary = await episodeAISummaryAPI(eid)
        if (!cancelled) setAiSummary(summary)
      } catch {
        // 429 / 网络失败：AI 摘要只是增强信息，不显示即可
      }
    }
    void Promise.resolve().then(loadSummary)
    return () => {
      cancelled = true
    }
  }, [eid])

  // 文字稿元数据：只有单集带 mediaId/transcript 时才请求
  useEffect(() => {
    if (!eid || !transcriptMediaId) return
    let cancelled = false
    const loadMeta = async () => {
      try {
        const meta = await episodeTranscriptAPI(eid, transcriptMediaId)
        if (!cancelled) setTranscriptMeta(meta)
      } catch {
        if (!cancelled) setTranscriptMeta(null)
      }
    }
    void Promise.resolve().then(loadMeta)
    return () => {
      cancelled = true
    }
  }, [eid, transcriptMediaId])

  // ?transcript=1 直接展开文字稿（截图 / 分享用）
  useEffect(() => {
    if (!transcriptMeta?.transcriptUrl) return
    if (new URLSearchParams(window.location.search).get('transcript') !== '1') return
    void Promise.resolve().then(() => setTranscriptOpen(true))
  }, [transcriptMeta])

  // 展开后才去取正文（CDN 签名地址由后端代理，见 /episode_transcript_content）
  // 注意：transcriptLoading 不能进依赖数组——setLoading(true) 会触发 effect 重跑，
  // 上一轮的 cleanup 把 cancelled 置 true，请求返回后既不写数据也不复位 loading（会永远骨架）。
  useEffect(() => {
    const url = transcriptMeta?.transcriptUrl
    if (!transcriptOpen || !url || transcriptSegments !== null) return
    let cancelled = false
    const loadContent = async () => {
      setTranscriptLoading(true)
      setTranscriptError(false)
      try {
        const segments = await episodeTranscriptContentAPI(url)
        if (!cancelled) setTranscriptSegments(Array.isArray(segments) ? segments : [])
      } catch {
        if (!cancelled) setTranscriptError(true)
      } finally {
        if (!cancelled) setTranscriptLoading(false)
      }
    }
    void Promise.resolve().then(loadContent)
    return () => {
      cancelled = true
    }
  }, [transcriptOpen, transcriptMeta, transcriptSegments, transcriptReloadToken])

  const loadFirstComments = useCallback(
    async (order: CommentOrder) => {
      if (!eid) return
      const gen = ++commentsGenRef.current
      setCommentsLoading(true)
      setCommentsError(false)
      setCommentsLoadMoreError(false)
      setComments([])
      setCommentLoadMoreKey(undefined)
      setCommentsHasMore(false)
      try {
        const res = await commentPrimaryAPI({ id: eid, order })
        if (gen !== commentsGenRef.current) return
        setComments(res.items || [])
        setCommentLoadMoreKey(res.loadMoreKey)
        setCommentsHasMore(Boolean(res.loadMoreKey))
      } catch {
        if (gen === commentsGenRef.current) setCommentsError(true)
      } finally {
        if (gen === commentsGenRef.current) setCommentsLoading(false)
      }
    },
    [eid],
  )

  useEffect(() => {
    if (commentOrder === 'TIMESTAMP') return
    void Promise.resolve().then(() => loadFirstComments(commentOrder))
  }, [commentOrder, loadFirstComments])

  // 时点评论：按当前 120s 窗口拉标记，再逐条取评论正文
  useEffect(() => {
    if (commentOrder !== 'TIMESTAMP' || !eid) return
    let cancelled = false
    const load = async () => {
      setTimepointLoading(true)
      setTimepointError(false)
      try {
        const markers = await commentTimestampPrimaryAPI({
          eid,
          from: timepointFrom,
          to: timepointFrom + TIMEPOINT_WINDOW,
        })
        const refs = markers.filter((marker) => typeof marker.timestamp === 'number').slice(0, 12)
        const results = await Promise.all(
          refs.map(async (marker) => {
            try {
              const comment = await commentGetAPI(marker.id)
              return { timestamp: marker.timestamp, comment }
            } catch {
              return null
            }
          }),
        )
        if (cancelled) return
        setTimepointItems(
          results.filter(
            (item): item is { timestamp: number; comment: CommentType } => item !== null && Boolean(item.comment),
          ),
        )
        setTimepointLoading(false)
      } catch {
        if (cancelled) return
        setTimepointItems([])
        setTimepointError(true)
        setTimepointLoading(false)
      }
    }
    void Promise.resolve().then(load)
    return () => {
      cancelled = true
    }
  }, [commentOrder, eid, timepointFrom, timepointReloadToken])

  const loadMoreComments = useCallback(async () => {
    if (!eid || !commentLoadMoreKey || commentsLoading || commentsLoadingMore) return
    const gen = commentsGenRef.current
    setCommentsLoadingMore(true)
    setCommentsLoadMoreError(false)
    try {
      const res = await commentPrimaryAPI({ id: eid, order: commentOrder, loadMoreKey: commentLoadMoreKey })
      if (gen !== commentsGenRef.current) return
      setComments((prev) => [...prev, ...(res.items || [])])
      setCommentLoadMoreKey(res.loadMoreKey)
      setCommentsHasMore(Boolean(res.loadMoreKey))
    } catch {
      if (gen === commentsGenRef.current) setCommentsLoadMoreError(true)
    } finally {
      if (gen === commentsGenRef.current) setCommentsLoadingMore(false)
    }
  }, [eid, commentOrder, commentLoadMoreKey, commentsLoading, commentsLoadingMore])

  const commentsSentinelRef = useInfiniteScroll(loadMoreComments, {
    enabled:
      commentOrder !== 'TIMESTAMP' &&
      Boolean(eid) &&
      !commentsLoading &&
      commentsHasMore &&
      !commentsLoadingMore &&
      !commentsLoadMoreError,
  })

  const patchComment = useCallback((commentId: string, patch: Partial<CommentType>) => {
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, ...patch } : c)))
  }, [])

  const removeComment = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }, [])

  /** 离开输入框即发布；失败时保留草稿、恢复可编辑，只给一句中文提示 */
  const submitComment = async () => {
    const text = draft.trim()
    if (!text || !eid || postLockRef.current) return
    postLockRef.current = true
    setPosting(true)
    try {
      await commentCreateAPI({ id: eid, type: 'EPISODE', text })
      message.success('评论已发布')
      setDraft('')
      setEpisode((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev))
      void loadFirstComments(commentOrder)
    } catch (err) {
      message.error(readableError(err, '评论发布失败，内容已保留，请重试'))
    } finally {
      postLockRef.current = false
      setPosting(false)
    }
  }

  const shownotesHtml = useMemo(() => {
    const raw = episode?.shownotes
    if (!raw) return ''
    return DOMPurify.sanitize(raw, SHOWNOTES_PURIFY_OPTIONS)
  }, [episode?.shownotes])

  const isCurrent = Boolean(episode) && currentEpisode?.eid === episode?.eid
  const totalDuration = isCurrent ? audioDuration || episode?.duration || 0 : episode?.duration || 0

  const playLabel = isCurrent ? (isPlaying ? '暂停' : '继续播放') : '播放'

  const toggleTranscript = () => setTranscriptOpen((open) => !open)
  const retryTranscript = () => {
    setTranscriptError(false)
    setTranscriptSegments(null)
    setTranscriptReloadToken((token) => token + 1)
  }

  const handlePlay = () => {
    if (!episode) return
    if (isCurrent) {
      togglePlay()
    } else {
      play(episode)
    }
  }

  const handleShare = async () => {
    if (!eid) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/episode/${eid}`)
      message.success('链接已复制')
    } catch {
      message.error('复制失败，请手动复制浏览器地址')
    }
  }

  const podcast = episode?.podcast

  // 播放模块滚出视口后，顶部浮出迷你播放条（Spotify 单集页的做法），
  // 保证读长文/评论时播放入口始终在。
  const playerBlockRef = useRef<HTMLDivElement>(null)
  const [miniPlayer, setMiniPlayer] = useState(false)

  useEffect(() => {
    const node = playerBlockRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setMiniPlayer(!entry.isIntersecting)
      },
      { threshold: 0, rootMargin: '-72px 0px 0px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [episode?.eid])

  return (
    <div>
      <div className="min-w-0">
      <BackButton />

      {loading ? (
        <EpisodeHeaderSkeleton />
      ) : error || !episode ? (
        <div className="mt-2">
          <p className="m-0 type-title text-[var(--ink)]">单集加载失败</p>
          <p className="m-0 mt-1.5 type-sub">{error}</p>
          <button type="button" className="pill pill-ink mt-5" onClick={() => void loadEpisode(true)}>
            重试
          </button>
        </div>
      ) : (
        <>
          {/* 媒体头：封面 + 节目/标题/元信息。播放模块单独放在下面，不和其他动作混排。 */}
          <div className="mt-1 flex items-start gap-4 sm:gap-5">
            <SmartImage
              image={episode.image ?? podcast?.image}
              aspectRatio={1}
              rounded="lg"
              className="h-[104px] w-[104px] flex-shrink-0 sm:h-[124px] sm:w-[124px]"
              alt={episode.title}
              priority
            />
            <div className="min-w-0 flex-1">
              {podcast && (
                <button
                  type="button"
                  onClick={() => navigate(`/podcast/${podcast.pid}`)}
                  className="group flex max-w-full items-center gap-2 border-0 bg-transparent p-0 text-left cursor-pointer"
                  aria-label={`回到节目 ${podcast.title}`}
                >
                  <SmartImage
                    image={podcast.image}
                    aspectRatio={1}
                    rounded="sm"
                    className="h-6 w-6 flex-shrink-0"
                    alt={podcast.title}
                  />
                  <span className="min-w-0 truncate type-manage text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--ink)]">
                    {podcast.title}
                  </span>
                </button>
              )}

              <h1 className="m-0 mt-2 type-headline text-[var(--ink)]">{episode.title}</h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 type-meta">
                {episode.pubDate && <span>{formatDate(episode.pubDate)}</span>}
                {episode.duration > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="tabnum">{formatDuration(episode.duration)}</span>
                  </>
                )}
                {episode.playCount > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="tabnum">{formatPlayCount(episode.playCount)}</span>
                  </>
                )}
                {episode.commentCount > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="tabnum">{formatCount(episode.commentCount)} 条评论</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 播放模块：页面上唯一的强调色位置，只有播放相关的内容 */}
          <div ref={playerBlockRef} className="mt-6 flex items-center gap-4">
            <PlayButton
              size="lg"
              variant="accent"
              playing={isCurrent && isPlaying}
              loading={isCurrent && audioLoading}
              onClick={handlePlay}
              label={playLabel}
            />
            <div className="min-w-0 flex-1">
              <WaveSeekbar
                value={Math.round(isCurrent ? currentTime : 0)}
                max={Math.max(1, Math.round(totalDuration || episode.duration || 1))}
                playing={isCurrent && isPlaying}
                disabled={!isCurrent}
                size="lg"
                bars={76}
                label="播放进度"
                onChangeComplete={(v) => {
                  seekTo(v)
                  // 时点 tab 下，seek 后刷新当前时间窗附近的标记
                  if (commentOrder === 'TIMESTAMP') {
                    setTimepointFrom(Math.max(0, Math.floor(v / TIMEPOINT_WINDOW) * TIMEPOINT_WINDOW))
                    setTimepointReloadToken((token) => token + 1)
                  }
                }}
              />
              <div className="mt-0.5 flex items-center justify-between gap-3 type-meta tabnum">
                <span>{formatDurationShort(isCurrent ? currentTime : 0)}</span>
                <span>{formatDurationShort(totalDuration || episode.duration || 0)}</span>
              </div>

            </div>
          </div>

          {/* 次级动作：收藏 / 分享，退到播放模块下面，不抢播放的视觉 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FavoriteButton episode={episode} withLabel />
            <button type="button" className="pill pill-ghost" onClick={() => void handleShare()}>
              <Link2 size={16} strokeWidth={1.75} />
              复制链接
            </button>
          </div>

          {/* AI 摘要：只有上游 status=ready 时出现，生成失败/限流则整块隐藏 */}
          {aiSummary?.brief && (
            <section className="mt-9">
              <SectionHead title="AI 摘要" level="section" />
              <p className="m-0 mt-2 whitespace-pre-wrap type-body" style={{ color: 'var(--ink-soft)' }}>
                {aiSummary.brief}
              </p>
              <p className="m-0 mt-2 type-meta">内容由 AI 生成，仅供参考</p>
            </section>
          )}

          {/* AI 文字稿：先取元数据，展开时再走后端代理拿 CDN 正文 */}
          {transcriptMeta?.transcriptUrl && (
            <section className="mt-9">
              <SectionHead
                title="AI 文字稿"
                level="section"
                action={
                  <button type="button" className="pill pill-ghost" onClick={toggleTranscript}>
                    {transcriptOpen ? '收起' : '展开'}
                  </button>
                }
              />
              {transcriptOpen &&
                (transcriptLoading ? (
                  <div className="mt-2">
                    <EpisodeRowsSkeleton count={3} />
                  </div>
                ) : transcriptError ? (
                  <div className="mt-2">
                    <p className="m-0 type-sub">文字稿加载失败。</p>
                    <button type="button" className="pill mt-3" onClick={retryTranscript}>
                      重试
                    </button>
                  </div>
                ) : transcriptSegments && transcriptSegments.length > 0 ? (
                  <>
                    <p className="m-0 mt-2 type-meta">{transcriptMeta.vendorDeclaration || '文字稿由小宇宙自动生成'}</p>
                    <div className="mt-1 max-h-[440px] overflow-y-auto pr-1">
                      {transcriptSegments.map((segment, index) => (
                        <div key={`${segment.startMs}-${index}`} className={index > 0 ? 'dotted-top' : undefined}>
                          <button
                            type="button"
                            onClick={() => {
                              if (isCurrent) seekTo(Math.floor(segment.startMs / 1000))
                              else play(episode)
                            }}
                            className="row w-full cursor-pointer border-0 bg-transparent"
                          >
                            <span className="w-12 flex-shrink-0 tabnum type-meta">
                              {formatDurationShort(Math.floor(segment.startMs / 1000))}
                            </span>
                            <span className="min-w-0 flex-1 type-sub text-[var(--ink)]">{segment.text}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="m-0 mt-2 type-sub">这一集还没有文字稿。</p>
                ))}
            </section>
          )}

          {/* 滚过播放模块后：顶部浮一个迷你播放条。已在播放本集时由底部播放条接管，不重复出现。 */}
          {miniPlayer && !isCurrent && (
            <div className="pointer-events-none fixed inset-x-0 top-16 z-20 lg:top-0">
              <div className="mx-auto w-full max-w-[var(--shell-max)] px-4 lg:px-5">
                <div className="pointer-events-auto ml-0 flex items-center gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_97%,transparent)] py-2.5 backdrop-blur-md lg:ml-[var(--rail)] xl:mr-[var(--right-w)]">
                  <SmartImage
                    image={episode.image ?? podcast?.image}
                    aspectRatio={1}
                    rounded="sm"
                    className="h-9 w-9 flex-shrink-0"
                    alt={episode.title}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate type-row-title text-[var(--ink)]">{episode.title}</p>
                    {podcast?.title && <p className="m-0 truncate type-meta">{podcast.title}</p>}
                  </div>
                  <PlayButton
                    size="md"
                    variant="accent"
                    playing={isCurrent && isPlaying}
                    loading={isCurrent && audioLoading}
                    onClick={handlePlay}
                    label={playLabel}
                  />
                </div>
              </div>
            </div>
          )}

          {episode.description && (
            <section className="mt-9">
              <SectionHead title="简介" level="section" />
              <p
                className={`m-0 mt-2 whitespace-pre-wrap ${shownotesHtml ? 'line-clamp-3 type-sub' : 'type-body-lg'}`}
                style={shownotesHtml ? undefined : { color: 'var(--ink-soft)' }}
              >
                {episode.description}
              </p>
            </section>
          )}

          {shownotesHtml && (
            <section className="mt-9">
              <SectionHead title="节目笔记" level="section" />
              <div className="shownotes mt-3" dangerouslySetInnerHTML={{ __html: shownotesHtml }} />
            </section>
          )}

          {(relatedLoading || relatedError || relatedEpisodes.length > 0) && (
            <section className="mt-9">
              <SectionHead title="相关单集" level="section" />
              {relatedLoading ? (
                <div className="mt-2">
                  <EpisodeRowsSkeleton count={3} />
                </div>
              ) : relatedError ? (
                <div className="mt-2">
                  <p className="m-0 type-sub">相关单集加载失败。</p>
                  <button
                    type="button"
                    className="pill mt-3"
                    onClick={() => setRelatedReloadToken((token) => token + 1)}
                  >
                    重试
                  </button>
                </div>
              ) : (
                <div className="dotted-rows mt-2">
                  {relatedEpisodes.slice(0, 6).map((related) => (
                    <EpisodeRow key={related.eid} episode={related} showPodcast />
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="dotted-top mt-12 pb-4 pt-8">
            <SectionHead
              title="评论"
              aside={episode.commentCount > 0 ? `${formatCount(episode.commentCount)} 条` : undefined}
              level="title"
            />

            <div className="mt-4 flex items-center gap-5" role="tablist" aria-label="评论排序">
              {COMMENT_ORDER_TABS.map((tab) => {
                const active = commentOrder === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setCommentOrder(tab.key)
                      if (tab.key === 'TIMESTAMP') {
                        const center = isCurrent ? currentTime : 0
                        setTimepointFrom(Math.max(0, Math.floor(center / TIMEPOINT_WINDOW) * TIMEPOINT_WINDOW))
                        setTimepointReloadToken((token) => token + 1)
                      }
                    }}
                    className="relative border-0 bg-transparent p-0 pb-2 type-group"
                    style={{ color: active ? 'var(--ink)' : 'var(--muted-foreground)', fontWeight: 500 }}
                  >
                    {tab.label}
                    {active && (
                      <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--accent)]" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex items-start gap-3">
              <span
                className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--muted-strong)] text-[15px] font-semibold text-[var(--muted-foreground)]"
                aria-hidden
              >
                {(currentUser?.nickname || '我').slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1 rounded-[20px] bg-[var(--muted)] px-4 py-3 transition-shadow focus-within:shadow-[inset_0_0_0_1px_var(--accent)]">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      void submitComment()
                    }
                  }}
                  rows={2}
                  disabled={posting}
                  placeholder="说点什么…"
                  aria-label="写评论"
                  className="w-full resize-none border-0 bg-transparent text-[15px] leading-[1.6] text-[var(--ink)] outline-none placeholder:text-[var(--faint)] disabled:opacity-60"
                />
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 type-meta">
                    {posting ? '发布中…' : '⌘/Ctrl + Enter 发布'}
                    <span className="hidden sm:inline">；⌘/Ctrl + Enter 也可以</span>
                  </p>
                  <button
                    type="button"
                    className="pill pill-ink"
                    disabled={!draft.trim() || posting}
                    onClick={() => void submitComment()}
                  >
                    {posting ? '发布中…' : '发布'}
                  </button>
                </div>
              </div>
            </div>

            {commentOrder === 'TIMESTAMP' ? (
              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 type-meta">
                    显示 {formatDurationShort(timepointFrom)}–
                    {formatDurationShort(timepointFrom + TIMEPOINT_WINDOW)} 附近的时点评论
                  </p>
                  <button
                    type="button"
                    className="pill pill-ghost"
                    onClick={() => setTimepointReloadToken((token) => token + 1)}
                  >
                    刷新附近
                  </button>
                </div>

                {timepointLoading ? (
                  <div className="mt-3">
                    <EpisodeRowsSkeleton count={2} cover={false} />
                  </div>
                ) : timepointError ? (
                  <div className="mt-2 py-6">
                    <p className="m-0 type-sub">时点评论加载失败，可能是网络不稳定。</p>
                    <button
                      type="button"
                      className="pill pill-ink mt-3"
                      onClick={() => setTimepointReloadToken((token) => token + 1)}
                    >
                      重试
                    </button>
                  </div>
                ) : timepointItems.length === 0 ? (
                  <EmptyState
                    title="这个时间点附近还没有评论"
                    hint="拖动播放进度后再看看，或切换回热门评论区。"
                    className="mt-2"
                  />
                ) : (
                  <div className="mt-2">
                    {timepointItems.map(({ timestamp, comment }, index) => (
                      <div
                        key={`${comment.id}-${timestamp}`}
                        className={index > 0 ? 'dotted-top' : undefined}
                      >
                        <div className="row">
                          <button
                            type="button"
                            onClick={() => {
                              if (isCurrent) seekTo(timestamp)
                              else if (episode) play(episode)
                            }}
                            className="w-12 flex-shrink-0 cursor-pointer border-0 bg-transparent p-0 text-left tabnum type-manage text-[var(--accent-ink)]"
                          >
                            {formatDurationShort(timestamp)}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <SmartImage
                                image={comment.author?.avatar?.picture}
                                aspectRatio={1}
                                rounded="full"
                                className="h-5 w-5 flex-shrink-0"
                                alt={comment.author?.nickname || '听友头像'}
                              />
                              <span className="min-w-0 truncate type-meta">
                                {comment.author?.nickname || '一位听友'}
                              </span>
                              {comment.likeCount > 0 && (
                                <span className="ml-auto flex-shrink-0 type-meta">
                                  {formatCount(comment.likeCount)} 赞
                                </span>
                              )}
                            </div>
                            <p className="m-0 mt-1 type-sub text-[var(--ink)]">{comment.text}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : commentsLoading ? (
              <div className="mt-4">
                <EpisodeRowsSkeleton count={3} cover={false} />
              </div>
            ) : commentsError ? (
              <div className="mt-2 py-8">
                <p className="m-0 type-sub">评论加载失败，可能是网络不稳定。</p>
                <button
                  type="button"
                  className="pill pill-ink mt-4"
                  onClick={() => void loadFirstComments(commentOrder)}
                >
                  重试
                </button>
              </div>
            ) : comments.length === 0 ? (
              <EmptyState title="还没有评论" hint="来写第一条评论吧。" className="mt-2" />
            ) : (
              <div className="mt-2">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    episodeId={eid ?? ''}
                    currentUserId={currentUserId}
                    onPatch={patchComment}
                    onDeleted={removeComment}
                  />
                ))}

                {commentsLoadingMore && (
                  <div className="mt-2">
                    <EpisodeRowsSkeleton count={1} cover={false} />
                  </div>
                )}

                {commentsLoadMoreError && (
                  <div className="flex items-center gap-3 py-4">
                    <p className="m-0 type-sub">加载更多评论失败</p>
                    <button type="button" className="pill" onClick={() => void loadMoreComments()}>
                      重试
                    </button>
                  </div>
                )}

                {commentsHasMore && !commentsLoadMoreError && (
                  <div ref={commentsSentinelRef} className="h-px" aria-hidden />
                )}
              </div>
            )}
          </section>
        </>
      )}
      </div>


    </div>
  )
}

function BackButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="-ml-2 inline-flex h-8 items-center gap-1.5 rounded-full border-0 bg-transparent px-2 type-sub text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
    >
      <ArrowLeft size={14} strokeWidth={1.75} />
      返回
    </button>
  )
}

function EpisodeHeaderSkeleton() {
  return (
    <div aria-busy="true">
      <div className="mt-2 flex items-center gap-2.5">
        <SkeletonBox className="h-8 w-8 flex-shrink-0" rounded="sm" />
        <SkeletonBox className="h-[13px] w-[160px]" rounded="sm" />
      </div>
      <SkeletonBox className="mt-4 h-[28px] w-[88%]" rounded="sm" />
      <SkeletonBox className="mt-2 h-[24px] w-[52%]" rounded="sm" />
      <SkeletonBox className="mt-3 h-[12px] w-[220px]" rounded="sm" />
      <div className="mt-6 flex items-center gap-3">
        <SkeletonBox className="h-14 w-14" rounded="full" />
        <SkeletonBox className="h-10 w-20" rounded="full" />
        <SkeletonBox className="h-8 w-24" rounded="full" />
      </div>
      <div className="mt-10 space-y-3">
        <SkeletonBox className="h-4 w-full" rounded="sm" />
        <SkeletonBox className="h-4 w-[94%]" rounded="sm" />
        <SkeletonBox className="h-4 w-[88%]" rounded="sm" />
        <SkeletonBox className="h-4 w-[70%]" rounded="sm" />
      </div>
      <div className="mt-10">
        <EpisodeRowsSkeleton count={3} cover={false} />
      </div>
    </div>
  )
}
