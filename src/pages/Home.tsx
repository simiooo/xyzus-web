import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { App as AntdApp } from 'antd'
import { ArrowRight } from 'lucide-react'
import {
  tabCategoryListAPI,
  tabDiscoveryListAPI,
  tabFeaturedListAPI,
  type HomeFeedLoadMoreKey,
  type HomeFeedPage,
  type HomeFeedParams,
} from '@/api/homeFeed'
import FollowingFeed from '@/components/feeds/FollowingFeed'
import SectionHead from '@/components/ui/SectionHead'
import { CACHE_TTL, isFresh, readPage, writePage } from '@/db/cache'
import EpisodeRow from '@/components/rows/EpisodeRow'
import PodcastRow from '@/components/rows/PodcastRow'
import SmartImage from '@/components/ui/SmartImage'
import EmptyState from '@/components/ui/EmptyState'
import { EpisodeRowsSkeleton, SkeletonBox } from '@/components/ui/Skeleton'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import type { DiscoveryRawSection, EpisodeBasic, ImageUrls, PodcastBasic } from '@/api/types'

/**
 * 发现页（X 式布局）：顶部是吸顶的内容流切换条，不再放大标题/副标题/“去榜单”按钮。
 *
 * 入口层级按使用频率映射：
 * - 高频内容流放一级 tab：为你推荐（算法流，默认）→ 关注（社交动态）→ 分类（主题浏览）→ 精选（编辑内容，更新最慢）；
 * - 榜单是「有明确目的才去」的工具入口，留在左栏主导航，不再占发现页 tab；
 * - 搜索/账号/消息留在顶栏，不混进内容流。
 *
 * 数据来源：
 * - 为你推荐：`/tab_discovery_list`（DISCOVERY_HEADER / 单集推荐 / 视频播客 / 三个榜单）
 * - 关注：`/following_updates_list`（复用 FollowingFeed）
 * - 分类：`/tab_category_list`（EPISODE_CATEGORY_BLOCKS）
 * - 精选：`/tab_featured_list`（DISCOVERY_HEADER / EDITOR_PICK / DISCOVERY_COLLECTION）
 *
 * 上游板块结构是多态且会变的，这里全部走容错读取：认不出的板块跳过，
 * 单集/节目缺字段时只降级展示，不让整页崩。
 */

type HomeTab = 'recommend' | 'following' | 'category' | 'featured'

/** 走 feed 接口的 tab（关注 tab 复用独立组件） */
type FeedTab = 'discovery' | 'category' | 'featured'

const TABS: { key: HomeTab; label: string }[] = [
  { key: 'recommend', label: '为你推荐' },
  { key: 'following', label: '关注' },
  { key: 'category', label: '分类' },
  { key: 'featured', label: '精选' },
]

const TAB_QUERY: Partial<Record<HomeTab, string>> = {
  following: 'following',
  category: 'category',
  featured: 'featured',
}

const FEED_FETCHER: Record<FeedTab, (params?: HomeFeedParams) => Promise<HomeFeedPage>> = {
  featured: tabFeaturedListAPI,
  discovery: tabDiscoveryListAPI,
  category: tabCategoryListAPI,
}

const EMPTY_COPY: Record<FeedTab, { title: string; hint: string }> = {
  featured: { title: '今天还没有精选内容', hint: '编辑还在准备内容，先去看看榜单吧。' },
  discovery: { title: '今天还没有新的推荐', hint: '过一会儿再回来看看，或者去榜单逛逛。' },
  category: { title: '分类内容还没准备好', hint: '可以先从分类页浏览全部节目。' },
}

const FEED_CACHE_TTL: Record<FeedTab, number> = {
  featured: CACHE_TTL.homeFeatured,
  discovery: CACHE_TTL.homeDiscovery,
  category: CACHE_TTL.homeCategory,
}

const TOP_LIST_ROUTE: Record<string, string> = {
  HOT_EPISODES_IN_24_HOURS: '/toplist/HOT',
  SKYROCKET_EPISODES: '/toplist/ROCK',
  NEW_STAR_EPISODES: '/toplist/NEW',
}

// ---------------------------------------------------------------------------
// 容错读取
// ---------------------------------------------------------------------------

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(readRecord(item)))
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isImageUrls(value: unknown): value is ImageUrls {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return ['picUrl', 'thumbnailUrl', 'smallPicUrl', 'middlePicUrl', 'largePicUrl'].some(
    (key) => typeof record[key] === 'string',
  )
}

/** 把 ImageUrls / URL 字符串 / `{picture}` / `{images:[…]}` 收敛成 SmartImage 能吃的东西 */
function imageFrom(value: unknown, depth = 0): ImageUrls | string | null {
  if (depth > 3) return null
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return null
  if (isImageUrls(value)) return value
  const record = value as Record<string, unknown>
  for (const key of ['picture', 'image', 'images', 'backgroundImage', 'leftImage']) {
    const nested = record[key]
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const image = imageFrom(item, depth + 1)
        if (image) return image
      }
    } else {
      const image = imageFrom(nested, depth + 1)
      if (image) return image
    }
  }
  return null
}

/** 单集条目可能是 `{episode}` / `{item}` / 裸 episode，统一摊平 */
function episodeFrom(value: unknown, depth = 0): EpisodeBasic | null {
  if (depth > 2 || !value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.eid === 'string' && record.eid) return value as unknown as EpisodeBasic
  for (const key of ['episode', 'item']) {
    const nested = record[key]
    if (nested && typeof nested === 'object') {
      const episode = episodeFrom(nested, depth + 1)
      if (episode) return episode
    }
  }
  return null
}

function episodesFrom(value: unknown, limit: number): EpisodeBasic[] {
  return asRecords(value)
    .map((entry) => episodeFrom(entry))
    .filter((episode): episode is EpisodeBasic => episode !== null)
    .slice(0, limit)
}

function podcastFrom(value: unknown): PodcastBasic | null {
  const record = readRecord(value)
  if (!record || typeof record.pid !== 'string') return null
  return record as unknown as PodcastBasic
}

type PromoLink =
  | { kind: 'internal'; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'app' }
  | { kind: 'none' }

/**
 * 活动位链接分三类：
 * - 站内路径 / http(s) 外链：直接可用；
 * - `cosmos://page.cos/webView?url=<https>`：内嵌的是 H5 页面，Web 端解出内层 https 后新窗口打开；
 * - 其余 `cosmos://`：App 内页面，Web 无法打开，点击时给出明确提示而不是装成不可点。
 */
function resolvePromoLink(rawUrl: string): PromoLink {
  const url = rawUrl.trim()
  if (!url) return { kind: 'none' }
  if (url.startsWith('/')) return { kind: 'internal', href: url }
  if (/^https?:\/\//i.test(url)) return { kind: 'external', href: url }
  if (url.startsWith('cosmos://page.cos/webView')) {
    try {
      const inner = new URL(url).searchParams.get('url')
      if (inner && /^https?:\/\//i.test(inner)) return { kind: 'external', href: inner }
    } catch {
      /* 非法 URL 归到 App-only 提示 */
    }
  }
  if (url.startsWith('cosmos://')) return { kind: 'app' }
  return { kind: 'none' }
}

// ---------------------------------------------------------------------------
// 板块
// ---------------------------------------------------------------------------

/**
 * 首页活动位（DISCOVERY_HEADER）真实结构是分层的：
 * - backgroundImage：整块背景（可能是纯色、渐变或装饰底图）
 * - leftImage.images：左侧图标（1~N 个，style=ROUNDED_CORNER 时圆角）
 * - rightContent.image：右侧文字/logo 图（透明底）
 * - color.light / color.dark：无背景图时的主题底色
 * 之前只取背景层，导致纯色素材显示成一整块空色块；这里按层合成卡片。
 */
interface PromoVisual {
  id: string
  url: string
  label?: string
  background: ImageUrls | string | null
  right: ImageUrls | string | null
  rightRatio: number
  leftImages: (ImageUrls | string)[]
  leftRounded: boolean
  colorLight?: string
  colorDark?: string
}

function imageRatio(image: ImageUrls | string | null): number {
  if (!image || typeof image === 'string') return 4
  const width = typeof image.width === 'number' ? image.width : 0
  const height = typeof image.height === 'number' ? image.height : 0
  return width > 0 && height > 0 ? width / height : 4
}

function promoVisual(item: Record<string, unknown>): PromoVisual | null {
  const background = imageFrom(item.backgroundImage)
  const rightContent = readRecord(item.rightContent)
  const right = imageFrom(rightContent?.image)
  const leftImage = readRecord(item.leftImage)
  const leftImages = asRecords(leftImage?.images)
    .map((image) => imageFrom(image))
    .filter((image): image is ImageUrls | string => image !== null)
  const promoColor = readRecord(item.color)
  const id = readText(item.id) || readText(item.url) || 'promo'
  const label = readText(rightContent?.text) || undefined

  if (!background && !right && leftImages.length === 0 && !label) return null

  return {
    id,
    url: readText(item.url),
    label,
    background,
    right,
    rightRatio: imageRatio(right),
    leftImages,
    leftRounded: readText(leftImage?.style) === 'ROUNDED_CORNER',
    colorLight: readText(promoColor?.light) || undefined,
    colorDark: readText(promoColor?.dark) || undefined,
  }
}

/**
 * 活动位 / 快捷入口：按官方定义优先级低，Web 端**所有尺寸**都收成一行小胶囊
 * （不换行、可横滑、隐藏滚动条），不再用大 hero / 两列网格占首屏。
 */
function PromoHeader({ items }: { items: Record<string, unknown>[] }) {
  const promos = items
    .map((item) => promoVisual(item))
    .filter((promo): promo is PromoVisual => promo !== null)
  if (promos.length === 0) return null

  return (
    <section className="mb-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-5 sm:px-5">
        {promos.map((promo) => (
          <PromoChip key={promo.id} promo={promo} />
        ))}
      </div>
    </section>
  )
}

/** 活动位小胶囊：44px 高（全尺寸），左侧图标 + 右侧文字图/文字标签，宽度随内容自适应 */
function PromoChip({ promo }: { promo: PromoVisual }) {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const backgroundColor = promo.colorLight || 'var(--muted)'
  const link = resolvePromoLink(promo.url)
  const clickable = link.kind !== 'none'
  const hasText = Boolean(promo.right || promo.label)

  const onClick = () => {
    if (link.kind === 'internal') {
      navigate(link.href)
      return
    }
    if (link.kind === 'external') {
      window.open(link.href, '_blank', 'noopener,noreferrer')
      return
    }
    if (link.kind === 'app') {
      message.info('该入口仅支持在小宇宙 App 内打开')
    }
  }

  const visual = (
    <div
      className={`relative flex h-[44px] flex-shrink-0 items-center gap-1.5 overflow-hidden rounded-[12px] ${
        hasText ? 'px-2.5' : 'w-[44px] justify-center px-0'
      }`}
      style={{ backgroundColor: promo.background ? undefined : backgroundColor }}
    >
      {promo.background && (
        <div className="absolute inset-0">
          <SmartImage
            image={promo.background}
            aspectRatio="auto"
            rounded="none"
            className="h-full w-full"
            imgClassName="object-cover"
            alt=""
            tone="sunken"
          />
        </div>
      )}

      {promo.leftImages.slice(0, 2).map((image, index) => (
        <SmartImage
          key={`${promo.id}-chip-left-${index}`}
          image={image}
          aspectRatio={1}
          rounded={promo.leftRounded ? 'md' : 'none'}
          className="relative h-6 w-auto flex-shrink-0"
          imgClassName="object-contain"
          alt=""
          tone="none"
        />
      ))}

      {promo.right ? (
        <SmartImage
          image={promo.right}
          aspectRatio={promo.rightRatio}
          rounded="none"
          className="relative h-[13px] w-auto flex-shrink-0"
          imgClassName="object-contain"
          alt="专题活动"
          tone="none"
        />
      ) : promo.label ? (
        <span className="relative whitespace-nowrap type-meta text-[var(--ink)]">{promo.label}</span>
      ) : (
        <span className="sr-only">专题活动</span>
      )}
    </div>
  )

  if (!clickable) return visual

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={promo.label || '专题活动'}
      className="flex-shrink-0 cursor-pointer border-0 bg-transparent p-0 transition-opacity hover:opacity-90"
    >
      {visual}
    </button>
  )
}

function EditorPickShelf({ data }: { data: Record<string, unknown> }) {
  const navigate = useNavigate()
  const picks = asRecords(data.picks)
    .map((pick) => ({ episode: episodeFrom(pick.episode), comment: pick.comment }))
    .filter((pick): pick is { episode: EpisodeBasic; comment: unknown } => pick.episode !== null)
    .slice(0, 5)
  if (picks.length === 0) return null

  return (
    <section className="mt-8">
      <SectionHead
        title="编辑精选"
        level="title"
        className="px-1"
        action={
          <button
            type="button"
            onClick={() => navigate('/editor-picks')}
            className="flex items-center gap-1 px-1 py-1 type-manage text-[var(--accent-ink)] transition-colors hover:text-[var(--accent-hover)]"
          >
            查看全部
            <ArrowRight size={12} strokeWidth={2} />
          </button>
        }
      />
      <div className="dotted-rows mt-2">
        {picks.map(({ episode, comment }, index) => {
          const note = readText(comment) || readText(readRecord(comment)?.text)
          return (
            <div key={`${episode.eid}-${index}`}>
              <EpisodeRow episode={episode} showPodcast />
              {note && <p className="m-0 mt-0.5 line-clamp-1 pl-20 type-sub">编辑推荐：{note}</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function RecommendShelf({ data }: { data: Record<string, unknown> }) {
  const entries = asRecords(data.target)
    .map((entry) => ({ episode: episodeFrom(entry), recommendation: readText(entry.recommendation) }))
    .filter((entry): entry is { episode: EpisodeBasic; recommendation: string } => entry.episode !== null)
    .slice(0, 6)
  if (entries.length === 0) return null
  const title = readText(data.title) || '为你推荐'

  return (
    <section className="mt-8">
      <SectionHead title={title} level="title" className="px-1" />
      <div className="dotted-rows mt-2">
        {entries.map(({ episode, recommendation }) => (
          <div key={episode.eid}>
            <EpisodeRow episode={episode} showPodcast />
            {recommendation && <p className="m-0 mt-0.5 line-clamp-1 pl-20 type-sub">{recommendation}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

function VideoShelf({ data }: { data: Record<string, unknown> }) {
  const episodes = episodesFrom(data.episodes, 6)
  if (episodes.length === 0) return null
  const title = readText(data.title) || '视频播客'

  return (
    <section className="mt-8">
      <SectionHead title={title} level="title" className="px-1" />
      <div className="dotted-rows mt-2">
        {episodes.map((episode) => (
          <EpisodeRow key={episode.eid} episode={episode} showPodcast />
        ))}
      </div>
    </section>
  )
}

function TopListShelf({ lists }: { lists: Record<string, unknown>[] }) {
  const navigate = useNavigate()
  return (
    <>
      {lists.map((list, index) => {
        const title = readText(list.title)
        if (!title) return null
        const category = readText(list.category)
        const route = TOP_LIST_ROUTE[category] ?? '/toplist/HOT'
        const episodes = episodesFrom(list.items, 3)
        if (episodes.length === 0) return null
        return (
          <section key={`${title}-${index}`} className="mt-8">
            <SectionHead
              title={title}
              level="title"
              className="px-1"
              action={
                <button
                  type="button"
                  onClick={() => navigate(route)}
                  className="flex items-center gap-1 px-1 py-1 type-manage text-[var(--accent-ink)] transition-colors hover:text-[var(--accent-hover)]"
                >
                  查看全部
                  <ArrowRight size={12} strokeWidth={2} />
                </button>
              }
            />
            <div className="dotted-rows mt-2">
              {episodes.map((episode, episodeIndex) => (
                <EpisodeRow key={episode.eid} episode={episode} rank={episodeIndex + 1} showPodcast />
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}

function CategoryBlocks({ blocks }: { blocks: Record<string, unknown>[] }) {
  const navigate = useNavigate()
  return (
    <>
      {blocks.map((block, index) => {
        const category = readRecord(block.data)
        if (!category) return null
        const name = readText(category.name)
        const id = readText(category.id)
        const episodes = episodesFrom(category.episodes, 4)
        if (!name || episodes.length === 0) return null
        return (
          <section key={`${id || name}-${index}`} className="mt-8">
            <SectionHead
              title={name}
              level="title"
              className="px-1"
              action={
                id ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/category/${id}`)}
                    className="flex items-center gap-1 px-1 py-1 type-manage text-[var(--accent-ink)] transition-colors hover:text-[var(--accent-hover)]"
                  >
                    查看全部
                    <ArrowRight size={12} strokeWidth={2} />
                  </button>
                ) : undefined
              }
            />
            <div className="dotted-rows mt-2">
              {episodes.map((episode) => (
                <EpisodeRow
                  key={episode.eid}
                  episode={episode}
                  showPodcast
                  showPlay={false}
                  dateStyle="none"
                />
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}

function CollectionShelf({ collections }: { collections: Record<string, unknown>[] }) {
  return (
    <>
      {collections.map((collection, index) => {
        const title = readText(collection.title)
        const entries = asRecords(collection.target)
          .map((entry) => ({ podcast: podcastFrom(entry.podcast), recommendation: readText(entry.recommendation) }))
          .filter((entry): entry is { podcast: PodcastBasic; recommendation: string } => entry.podcast !== null)
          .slice(0, 4)
        if (!title || entries.length === 0) return null
        return (
          <section key={`${title}-${index}`} className="mt-8">
            <SectionHead title={title} level="title" className="px-1" />
            <div className="dotted-rows mt-2">
              {entries.map(({ podcast, recommendation }) => (
                <div key={podcast.pid}>
                  <PodcastRow podcast={podcast} />
                  {recommendation && <p className="m-0 mt-0.5 line-clamp-1 pl-20 type-sub">{recommendation}</p>}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}

function FeedSection({ section }: { section: DiscoveryRawSection }) {
  const data = section.data
  switch (section.type) {
    case 'DISCOVERY_HEADER':
      return <PromoHeader items={asRecords(data)} />
    case 'EDITOR_PICK': {
      const record = readRecord(data)
      return record ? <EditorPickShelf data={record} /> : null
    }
    case 'DISCOVERY_EPISODE_RECOMMEND':
    case 'DISCOVERY_EPISODE_RECOMMEND_V3': {
      const record = readRecord(data)
      return record ? <RecommendShelf data={record} /> : null
    }
    case 'DISCOVERY_VIDEO_PODCAST': {
      const record = readRecord(data)
      return record ? <VideoShelf data={record} /> : null
    }
    case 'TOP_LIST':
      return <TopListShelf lists={asRecords(data)} />
    case 'EPISODE_CATEGORY_BLOCKS':
      return <CategoryBlocks blocks={asRecords(data)} />
    case 'DISCOVERY_COLLECTION':
      return <CollectionShelf collections={asRecords(data)} />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// 单个 tab 的分页容器
// ---------------------------------------------------------------------------

function FeedSkeleton() {
  return (
    <div aria-busy="true">
      <SkeletonBox className="w-full" style={{ aspectRatio: 2.2 }} rounded="lg" />
      {[0, 1].map((index) => (
        <div key={index} className="mt-8">
          <SkeletonBox className="h-[21px] w-[140px]" rounded="sm" />
          <div className="mt-2">
            <EpisodeRowsSkeleton count={index === 0 ? 3 : 4} />
          </div>
        </div>
      ))}
    </div>
  )
}

function FeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-10">
      <p className="m-0 type-title text-[var(--ink)]">没能加载出来</p>
      <p className="m-0 mt-1.5 max-w-[420px] type-sub">内容没能取回来，可能是网络或服务暂时不可用。</p>
      <button type="button" onClick={onRetry} className="pill pill-ink mt-4">
        重试
      </button>
    </div>
  )
}

function FeedPanel({ tab, hidden }: { tab: FeedTab; hidden: boolean }) {
  const navigate = useNavigate()
  const [sections, setSections] = useState<DiscoveryRawSection[]>([])
  const [loadMoreKey, setLoadMoreKey] = useState<HomeFeedLoadMoreKey | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const sectionsRef = useRef<DiscoveryRawSection[]>([])

  const fetcher = FEED_FETCHER[tab]

  useEffect(() => {
    let cancelled = false
    const force = reloadToken > 0
    const load = async () => {
      setError(false)
      let hadCache = false
      if (!force) {
        const cached = await readPage<DiscoveryRawSection[]>('homeFeed', tab)
        if (cancelled) return
        if (cached && Array.isArray(cached.payload) && cached.payload.length > 0) {
          hadCache = true
          sectionsRef.current = cached.payload
          setSections(cached.payload)
          setLoadMoreKey(cached.loadMoreKey as HomeFeedLoadMoreKey | undefined)
          setLoading(false)
          if (isFresh(cached.fetchedAt, FEED_CACHE_TTL[tab])) return
        }
      }
      if (!hadCache) setLoading(true)
      try {
        const page = await fetcher()
        if (cancelled) return
        const items = Array.isArray(page.items) ? page.items : []
        sectionsRef.current = items
        setSections(items)
        setLoadMoreKey(page.loadMoreKey)
        setLoading(false)
        void writePage('homeFeed', tab, items, page.loadMoreKey)
      } catch {
        if (cancelled) return
        if (!hadCache) {
          setSections([])
          sectionsRef.current = []
          setError(true)
        }
        setLoading(false)
      }
    }
    // 不在 effect 体内同步 setState（react-hooks/set-state-in-effect）：推一个微任务再开始加载
    void Promise.resolve().then(load)
    return () => {
      cancelled = true
    }
  }, [fetcher, tab, reloadToken])

  const loadMore = useCallback(() => {
    if (loadMoreKey === undefined || loadingMore) return
    setLoadingMore(true)
    setLoadMoreError(false)
    fetcher({ loadMoreKey })
      .then((page) => {
        const next = [...sectionsRef.current, ...(Array.isArray(page.items) ? page.items : [])]
        sectionsRef.current = next
        setSections(next)
        setLoadMoreKey(page.loadMoreKey)
        void writePage('homeFeed', tab, next, page.loadMoreKey)
      })
      .catch(() => setLoadMoreError(true))
      .finally(() => setLoadingMore(false))
  }, [fetcher, loadMoreKey, loadingMore, tab])

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: !hidden && loadMoreKey !== undefined && !loading && !loadingMore && !loadMoreError,
  })

  const copy = EMPTY_COPY[tab]

  return (
    <div hidden={hidden}>
      {loading ? (
        <FeedSkeleton />
      ) : error ? (
        <FeedError onRetry={() => setReloadToken((token) => token + 1)} />
      ) : sections.length === 0 ? (
        <EmptyState
          title={copy.title}
          hint={copy.hint}
          action={
            <button type="button" className="pill pill-ink" onClick={() => navigate('/toplist/HOT')}>
              去看榜单
            </button>
          }
        />
      ) : (
        <>
          {sections.map((section, index) => (
            <FeedSection key={`${section.type}-${index}`} section={section} />
          ))}

          {loadingMore && (
            <div className="mt-3">
              <EpisodeRowsSkeleton count={2} />
            </div>
          )}

          {loadMoreError ? (
            <div className="dotted-top mt-4 py-6">
              <p className="m-0 type-sub">更多内容没能加载出来。</p>
              <button type="button" onClick={loadMore} className="pill pill-ink mt-3">
                重试
              </button>
            </div>
          ) : (
            loadMoreKey !== undefined && <div ref={sentinelRef} className="h-1" aria-hidden />
          )}
        </>
      )}
    </div>
  )
}

/** URL 参数 → 当前 tab；兼容旧的 `?homeTab=discovery|category|featured` */
function readTabFromParams(params: URLSearchParams): HomeTab {
  const raw = params.get('tab') ?? params.get('homeTab')
  if (raw === 'following') return 'following'
  if (raw === 'category' || raw === 'categories') return 'category'
  if (raw === 'featured') return 'featured'
  return 'recommend'
}

/**
 * 发现页：X 式吸顶 tab + 内容流。每个 tab 首次点开才加载，之后保留已加载内容；
 * URL 同步（`?tab=following|category|featured`，默认不带参数=为你推荐），可分享/刷新保持。
 */
export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = readTabFromParams(searchParams)
  const [visited, setVisited] = useState<Record<HomeTab, boolean>>(() => {
    const initial = readTabFromParams(new URLSearchParams(window.location.search))
    return {
      recommend: initial === 'recommend',
      following: initial === 'following',
      category: initial === 'category',
      featured: initial === 'featured',
    }
  })

  // 前进/后退或分享直达时，也要把对应 panel 挂载出来（挂载后才能保留状态）
  useEffect(() => {
    if (visited[tab]) return
    void Promise.resolve().then(() =>
      setVisited((prev) => (prev[tab] ? prev : { ...prev, [tab]: true })),
    )
  }, [tab, visited])

  const switchTab = (next: HomeTab) => {
    const params = new URLSearchParams(searchParams)
    params.delete('homeTab')
    const query = TAB_QUERY[next]
    if (query) params.set('tab', query)
    else params.delete('tab')
    setSearchParams(params, { replace: true })
    setVisited((prev) => (prev[next] ? prev : { ...prev, [next]: true }))
  }

  return (
    <div>
      <h1 className="sr-only">发现</h1>

      {/* X 式吸顶 tab：贴内容区顶边，整条底边线；移动端在顶栏（64px）之下吸顶 */}
      <div
        role="tablist"
        aria-label="发现内容流"
        className="sticky top-16 z-10 -mx-4 -mt-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-4 backdrop-blur-md lg:top-0 lg:-mx-5 lg:-mt-4 lg:px-5"
      >
        <div className="flex items-center gap-7 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((item) => {
            const selected = item.key === tab
            return (
              <button
                key={item.key}
                id={`home-tab-${item.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => switchTab(item.key)}
                className="relative flex-shrink-0 cursor-pointer border-0 bg-transparent px-0 pb-3 pt-3.5 type-group transition-colors"
                style={{
                  color: selected ? 'var(--ink)' : 'var(--muted-foreground)',
                  fontWeight: selected ? 600 : 500,
                }}
              >
                {item.label}
                {selected && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--accent)]" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="pt-4">
        {visited.recommend && <FeedPanel tab="discovery" hidden={tab !== 'recommend'} />}
        {visited.following && (
          <div hidden={tab !== 'following'} id="home-panel-following">
            <FollowingFeed embedded />
          </div>
        )}
        {visited.category && <FeedPanel tab="category" hidden={tab !== 'category'} />}
        {visited.featured && <FeedPanel tab="featured" hidden={tab !== 'featured'} />}
      </div>
    </div>
  )
}
