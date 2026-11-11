/**
 * Mock 端点解析层
 *
 * adapter（src/mock/adapter.ts）和独立 HTTP mock server（scripts/mock-server.mjs）
 * 共用这一份「端点 → fixture」的逻辑，保证两种启用方式返回完全一致的数据。
 *
 * 约定（与 src/api/normalize.ts 的注释对齐）：
 * - handler 返回的是「alova 响应拦截器剥掉 { code, msg, data } 之后」的 data，
 *   也就是 xyz 后端组装出来的「上游原始 JSON body」。页面不会直接看到它 ——
 *   src/api/*.ts 的 unwrapData / unwrapPage / pluckList 会再归一化一次。
 * - 所以这里刻意按「真实后端形状」返回（例如 top_list 是 `{data:{items:[{item:<episode>}]}}`），
 *   让归一化代码也在 mock 模式下被真实走一遍。
 * - 所有端点按「请求路径最后一段」匹配（/api/podcast_detail → podcast_detail）。
 * - 所有端点都是 POST，参数在 body 里。
 * - 支持 delay（默认 600ms，可用 `?delay=…` query 或 body 里的 `__delay` 覆盖），
 *   分页（body 里带了 loadMoreKey 就返回下一页）。
 *
 * 这个文件只 import type（Node 24 的 type stripping 可以直接加载它，
 * 供 scripts/mock-server.mjs 与 scripts/shot.mjs 的 API 拦截复用）。
 */
import type {
  Comment,
  CommentPrimaryLoadMoreKey,
  CursorKey,
  EpisodeBasic,
  EpisodeListResponse,
  PodcastBasic,
  SearchRawItem,
  SearchResponse,
  UserBasic,
} from '@/api/types'
import {
  allUsers,
  categories,
  categoryPodcasts,
  categoryTabs,
  collectedComments,
  commentReplies,
  commentsByEpisode,
  discoveryPage1,
  discoveryPage2,
  editorPickHistory,
  episodeDetails,
  episodeAISummaries,
  episodeTranscripts,
  mockTranscriptSegments,
  episodes,
  episodesByEid,
  episodesByPid,
  favoriteEpisodes,
  followingUpdates,
  homeCategoryMoreSections,
  homeCategorySections,
  homeDiscoveryMoreSections,
  homeDiscoverySections,
  homeFeaturedMoreSections,
  homeFeaturedSections,
  inboxUpdates,
  keywordMatches,
  mockLoginResponse,
  mockPodcastGetInfo,
  mockProfile,
  mockProfileResponse,
  mockRefreshResponse,
  mockUnreadCount,
  myComments,
  noticeUpdates,
  oftenPlayedPodcasts,
  pickRecentItems,
  pilotDiscovery,
  podcastRelated,
  podcasts,
  podcastsByPid,
  relatedEpisodes,
  searchPresets,
  subscriptions,
  topLists,
} from './fixtures.ts'

export type MockBody = Record<string, unknown>

/** 判定 mock 是否启用时默认的延时 */
export const DEFAULT_MOCK_DELAY = 600

/** 每个分页端点一页的条数 */
const PAGE_SIZE = {
  episodes: 8,
  search: 6,
  comments: 6,
  subscription: 5,
  editorPicks: 3,
  pilot: 4,
  categoryPodcasts: 8,
  inbox: 6,
  notice: 6,
} as const

const TOP_LIST_META: Record<'HOT' | 'ROCK' | 'NEW', { title: string; information: string }> = {
  HOT: { title: '热门榜', information: '最近 24 小时被播放最多的单集' },
  ROCK: { title: '潜力榜', information: '正在被更多人听见的新节目' },
  NEW: { title: '新星榜', information: '刚刚上线、值得关注的新单集' },
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function hasLoadMoreKey(body: MockBody): boolean {
  return Boolean(body.loadMoreKey)
}

/** 从 body 里取评论归属的单集 id：新 api 层传 owner.id，旧写法兼容 body.id */
function readEpisodeId(body: MockBody): string {
  const owner = asRecord(body.owner)
  return asString(owner.id, asString(body.id, 'mock-eid'))
}

/** 用 body 里的任意字段过滤：keywords 里任意一个命中即可 */
function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => keywordMatches(text, keyword))
}

/** 把 URL 的路径最后一段当作端点名（/api/podcast_detail → podcast_detail） */
export function resolveEndpointName(url: string): string {
  let pathname: string
  try {
    pathname = new URL(url, 'http://mock.local').pathname
  } catch {
    pathname = url.split('?')[0].split('#')[0]
  }
  return pathname.replace(/\/+$/, '').split('/').pop() ?? ''
}

/** 解析 delay 覆盖：query > body.__delay > 运行时全局设置 */
export function resolveMockDelay(
  url: string,
  body: MockBody,
  fallback = DEFAULT_MOCK_DELAY,
): number {
  const override = readDelayOverride(url, body)
  if (override !== undefined) return override
  if (typeof globalThis !== 'undefined') {
    const runtimeDelay = (globalThis as { __XYZ_MOCK_DELAY__?: unknown }).__XYZ_MOCK_DELAY__
    if (typeof runtimeDelay === 'number' && Number.isFinite(runtimeDelay) && runtimeDelay >= 0) {
      return runtimeDelay
    }
  }
  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
    try {
      const stored = localStorage.getItem('xyz-mock-delay')
      if (stored !== null && stored !== '') {
        const parsed = Number(stored)
        if (Number.isFinite(parsed) && parsed >= 0) return parsed
      }
    } catch {
      // ignore
    }
  }
  return fallback
}

function readDelayOverride(url: string, body: MockBody): number | undefined {
  const queryIndex = url.indexOf('?')
  if (queryIndex >= 0) {
    const params = new URLSearchParams(url.slice(queryIndex))
    const queryDelay = params.get('delay') ?? params.get('mockDelay') ?? params.get('mock_delay')
    if (queryDelay !== null) {
      const parsed = Number(queryDelay)
      if (Number.isFinite(parsed) && parsed >= 0) return parsed
    }
  }
  const bodyDelay = body.__delay ?? body.mockDelay
  if (typeof bodyDelay === 'number' && Number.isFinite(bodyDelay) && bodyDelay >= 0) {
    return bodyDelay
  }
  if (typeof bodyDelay === 'string') {
    const parsed = Number(bodyDelay)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return undefined
}

// ---------------------------------------------------------------------------
// 端点 handler 实现
// ---------------------------------------------------------------------------

function handleDiscovery(body: MockBody): unknown {
  return hasLoadMoreKey(body) ? discoveryPage2 : discoveryPage1
}

function handleTopList(body: MockBody): unknown {
  const category = asString(body.category, 'HOT').toUpperCase()
  const key: 'HOT' | 'ROCK' | 'NEW' =
    category === 'ROCK' || category === 'NEW' ? category : 'HOT'
  return {
    data: {
      items: topLists[key].map((episode) => ({ item: episode })),
      ...TOP_LIST_META[key],
      totalCount: topLists[key].length,
    },
  }
}

function handlePodcastDetail(body: MockBody): unknown {
  const pid = asString(body.pid, 'mock-pid')
  return { data: podcastsByPid[pid] ?? podcasts[0] }
}

function episodeForPid(pid: string): EpisodeBasic[] {
  return episodesByPid[pid] ?? episodesByPid['mock-pid']
}

function handleEpisodeList(body: MockBody): EpisodeListResponse {
  const pid = asString(body.pid, 'mock-pid')
  const order = asString(body.order, 'desc') === 'asc' ? 'asc' : 'desc'
  const sorted =
    order === 'asc' ? [...episodeForPid(pid)].reverse() : [...episodeForPid(pid)]
  const offset = hasLoadMoreKey(body) ? PAGE_SIZE.episodes : 0
  const page = sorted.slice(offset, offset + PAGE_SIZE.episodes)
  const hasMore = offset + PAGE_SIZE.episodes < sorted.length
  const last = page[page.length - 1]
  const loadMoreKey: CursorKey | undefined =
    hasMore && last ? { direction: 'NEXT', id: last.eid, pubDate: last.pubDate } : undefined
  return { data: page, loadMoreKey, order, total: sorted.length }
}

function handlePodcastRelated(body: MockBody): unknown {
  const pid = asString(body.pid, 'mock-pid')
  const related =
    podcastRelated[pid] ??
    podcasts
      .filter((podcast) => podcast.pid !== pid)
      .slice(0, 4)
      .map((podcast) => ({ podcast }))
  return { data: related }
}

function handleEpisodeDetail(body: MockBody): unknown {
  const eid = asString(body.eid, 'mock-eid')
  const detail = episodeDetails[eid] ?? episodeDetails['mock-eid']
  return { data: detail }
}

function handleEpisodeListByFilter(body: MockBody): unknown {
  const pid = asString(body.pid, 'mock-pid')
  const filter = asString(body.filter, 'ALL').toUpperCase()
  const list = episodeForPid(pid)
  if (filter.includes('FAV')) return { data: list.filter((episode) => episode.isFavorited) }
  if (filter.includes('PICK')) return { data: list.filter((episode) => episode.isPicked) }
  if (filter.includes('UNPLAY') || filter.includes('INCOMPLETE')) {
    return { data: list.filter((episode) => !episode.isPlayed) }
  }
  if (filter.includes('PLAYED')) return { data: list.filter((episode) => episode.isPlayed) }
  return { data: list }
}

function buildSearchItems(
  keyword: string,
  type: string,
  page: number,
): { data: SearchRawItem[]; loadMoreKey?: string } {
  const matchedPodcasts = podcasts.filter((podcast) =>
    matchesAny(`${podcast.title} ${podcast.author} ${podcast.brief ?? ''}`, [keyword]),
  )
  const matchedEpisodes = episodes.filter((episode) =>
    matchesAny(`${episode.title} ${episode.description} ${episode.podcast.title}`, [keyword]),
  )
  const matchedUsers = allUsers.filter((user) =>
    matchesAny(`${user.nickname} ${user.bio ?? ''}`, [keyword]),
  )

  const empty = matchedPodcasts.length + matchedEpisodes.length + matchedUsers.length === 0
  if (!keyword.trim() || empty) return { data: [] }

  const data: SearchRawItem[] = []

  if (type === 'PODCAST') {
    const slice = matchedPodcasts.slice(
      page === 0 ? 0 : PAGE_SIZE.search,
      page === 0 ? PAGE_SIZE.search : PAGE_SIZE.search * 2,
    )
    data.push({ type: 'HEADER', title: `${matchedPodcasts.length} 个相关播客` })
    data.push(...slice)
    if (matchedPodcasts.length > PAGE_SIZE.search * (page + 1)) {
      data.push({ type: 'FOOTER', title: '继续加载更多播客', link: '#' })
      return { data, loadMoreKey: `mock-search-podcast-page-${page + 2}` }
    }
    return { data }
  }

  if (type === 'EPISODE') {
    const slice = matchedEpisodes.slice(
      page === 0 ? 0 : PAGE_SIZE.search,
      page === 0 ? PAGE_SIZE.search : PAGE_SIZE.search * 2,
    )
    data.push({ type: 'HEADER', title: `${matchedEpisodes.length} 个相关单集` })
    data.push(...slice)
    if (matchedEpisodes.length > PAGE_SIZE.search * (page + 1)) {
      data.push({ type: 'FOOTER', title: '继续加载更多单集', link: '#' })
      return { data, loadMoreKey: `mock-search-episode-page-${page + 2}` }
    }
    return { data }
  }

  if (type === 'USER') {
    const slice = matchedUsers.slice(
      page === 0 ? 0 : PAGE_SIZE.search,
      page === 0 ? PAGE_SIZE.search : PAGE_SIZE.search * 2,
    )
    data.push({ type: 'HEADER', title: `${matchedUsers.length} 位相关用户` })
    if (slice.length > 0) data.push({ type: 'SEARCHED_USERS', users: slice })
    if (matchedUsers.length > PAGE_SIZE.search * (page + 1)) {
      data.push({ type: 'FOOTER', title: '继续加载更多用户', link: '#' })
      return { data, loadMoreKey: `mock-search-user-page-${page + 2}` }
    }
    return { data }
  }

  // ALL：播客 + 单集 + 用户，按 HEADER/FOOTER 分组
  if (page > 0) {
    const slice = matchedEpisodes.slice(PAGE_SIZE.search, PAGE_SIZE.search * 2)
    data.push({ type: 'HEADER', title: '更多相关单集' })
    data.push(...slice)
    return { data }
  }

  if (matchedPodcasts.length > 0) {
    data.push({ type: 'HEADER', title: '播客' })
    data.push(...matchedPodcasts.slice(0, 4))
    data.push({ type: 'FOOTER', title: `查看全部 ${matchedPodcasts.length} 个播客`, link: '#' })
  }
  if (matchedEpisodes.length > 0) {
    data.push({ type: 'HEADER', title: '单集' })
    data.push(...matchedEpisodes.slice(0, PAGE_SIZE.search))
  }
  if (matchedUsers.length > 0) {
    data.push({ type: 'SEARCHED_USERS', users: matchedUsers.slice(0, 4) })
  }
  if (matchedEpisodes.length > PAGE_SIZE.search) {
    data.push({ type: 'FOOTER', title: '查看更多结果', link: '#' })
    return { data, loadMoreKey: 'mock-search-page-2' }
  }
  return { data }
}

function handleSearch(body: MockBody): SearchResponse & { highlightWord?: { words: string[]; singleMaxHighlightTime: number } } {
  const keyword = asString(body.keyword)
  const type = asString(body.type, 'ALL').toUpperCase()
  const page = hasLoadMoreKey(body) ? 1 : 0
  const result = buildSearchItems(keyword, type, page)
  return {
    data: result.data,
    ...(result.loadMoreKey ? { loadMoreKey: result.loadMoreKey } : {}),
    ...(keyword.trim()
      ? { highlightWord: { words: [keyword.trim()], singleMaxHighlightTime: 300 } }
      : {}),
  }
}

function handleSearchPreset(): unknown {
  return { data: searchPresets }
}

function handleCommentPrimary(body: MockBody): unknown {
  const eid = readEpisodeId(body)
  const base = commentsByEpisode[eid] ?? commentsByEpisode['mock-eid'] ?? []
  const order = asString(body.order, 'HOT').toUpperCase()
  const sorted = [...base].sort((a, b) => {
    if (order === 'TIME' || order === 'TIMESTAMP') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.likeCount - a.likeCount
  })
  const offset = hasLoadMoreKey(body) ? PAGE_SIZE.comments : 0
  const page = sorted.slice(offset, offset + PAGE_SIZE.comments)
  const hasMore = offset + PAGE_SIZE.comments < sorted.length
  const last = page[page.length - 1]
  const loadMoreKey: CommentPrimaryLoadMoreKey | undefined =
    hasMore && last ? { direction: 'NEXT', hotSortScore: last.likeCount, id: last.id } : undefined
  return { data: page, loadMoreKey, totalCount: sorted.length }
}

function handleCommentThread(body: MockBody): unknown {
  const primaryCommentId = asString(body.primaryCommentId)
  const replies =
    commentReplies[primaryCommentId] ??
    (commentsByEpisode['mock-eid'] ?? []).slice(1, 4).map((comment) => ({
      ...comment,
      id: `reply-${primaryCommentId}-${comment.id}`,
      level: 1,
      thread: primaryCommentId,
    }))
  return { data: replies }
}

/** 回复评论 v2：真实响应多一个 totalCount */
function handleCommentListThreadV2(body: MockBody): unknown {
  const result = handleCommentThread(body) as { data: Comment[] }
  return { data: result.data, totalCount: result.data.length }
}

/** 我的评论：按最新 / 最热排序（真实接口 body {order, limit}） */
function handleMyComments(body: MockBody): unknown {
  const order = asString(body.order, 'TIME').toUpperCase()
  const list = [...myComments].sort((a, b) =>
    order === 'LIKE'
      ? b.likeCount - a.likeCount
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  return { data: list }
}

/** 时点评论：真实接口按 owner + from/to 查询，返回时点标记 {id,timestamp,type} */
function handleTimestampComments(body: MockBody): unknown {
  const owner = asRecord(body.owner)
  const eid = asString(owner.id, asString(body.id))
  const from = typeof body.from === 'number' ? body.from : 0
  const base = commentsByEpisode[eid] ?? commentsByEpisode['mock-eid'] ?? []
  const markers = base.slice(0, 3).map((comment, index) => ({
    id: comment.id,
    timestamp: from + 12 + index * 37,
    type: 'COMMENT',
  }))
  return { data: markers }
}

/** 按 id 取单条评论（时点标记 → 评论正文） */
function handleCommentGet(body: MockBody): unknown {
  const id = asString(body.commentId)
  const all = [...Object.values(commentsByEpisode).flat(), ...myComments]
  const found = all.find((comment) => comment.id === id) ?? all[0]
  return { data: found }
}

/** AI 摘要：真实响应 {requested, summary:{status,brief}|null, confirmation} */
function handleAISummary(body: MockBody): unknown {
  const eid = asString(body.eid)
  return { requested: false, summary: episodeAISummaries[eid] ?? null, confirmation: null }
}

/** 关注动态：真实响应 {data: [...], showSticker} */
function handleFollowingUpdates(): unknown {
  return { data: followingUpdates, showSticker: false }
}

/** 常听节目：真实响应 {data: PodcastBasic[]} */
function handleOftenPlayed(): unknown {
  return { data: oftenPlayedPodcasts }
}

/** 文字稿元数据：真实响应 {key, vendorDeclaration, transcriptUrl, highlightUrl} */
function handleEpisodeTranscriptMeta(body: MockBody): unknown {
  const eid = asString(body.eid)
  return (
    episodeTranscripts[eid] ?? {
      key: `mock-transcript-${asString(body.mediaId, eid)}:1`,
      vendorDeclaration: '文字稿由小宇宙自动生成（Mock）',
      transcriptUrl: `https://transcript.xyzcdn.net/mock/${eid}`,
      highlightUrl: '',
    }
  )
}

/** 文字稿正文：真实 CDN JSON 是 [{text, startMs}]，由后端代理后原样返回 */
function handleEpisodeTranscriptContent(): unknown {
  return mockTranscriptSegments
}

// ---------------------------------------------------------------------------
// 播放现场同步（/playback_progress_*、/episode_played_*）
// ---------------------------------------------------------------------------

/** mock 的服务端进度：打开页面时用来演示「从服务端恢复上次播放」 */
const mockPlaybackProgress: Record<string, { eid: string; pid: string; progress: number; playedAt: string }> = {
  'mock-eid': {
    eid: 'mock-eid',
    pid: 'mock-pid',
    progress: 120,
    playedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
}

function handlePlaybackProgressList(body: MockBody): unknown {
  const eids = Array.isArray(body.eids) ? body.eids.map((item) => asString(item)) : []
  return { data: eids.map((eid) => mockPlaybackProgress[eid]).filter(Boolean) }
}

/** 进度上报：mock 只更新内存，便于同一会话里再读回来 */
function handlePlaybackProgressUpdate(body: MockBody): unknown {
  const list = Array.isArray(body.data) ? body.data : []
  for (const raw of list) {
    const item = asRecord(raw)
    const eid = asString(item.eid)
    if (!eid) continue
    const progress = typeof item.progress === 'number' ? item.progress : Number(item.progress) || 0
    mockPlaybackProgress[eid] = {
      eid,
      pid: asString(item.pid, mockPlaybackProgress[eid]?.pid ?? 'mock-pid'),
      progress,
      playedAt: asString(item.playedAt, new Date().toISOString()),
    }
  }
  return null
}

// 最近收听增量同步快照（/episode_played_list_for_cache）：模拟 App 的版本游标。
// 播放新单集（episode_played_create）会推进版本，让下次同步拿到 needRefresh=true。
let mockPlayedCacheVersion = new Date(Date.now() - 30 * 60 * 1000).toISOString()
let mockPlayedCache = episodes.slice(0, 5).map((ep) => ({
  id: ep.eid,
  type: 'EPISODE',
  title: ep.title,
  description: ep.description,
  podcast: ep.podcast,
}))

function handleEpisodePlayedCreate(body: MockBody): unknown {
  const ep = episodesByEid[asString(body.eid)]
  if (ep) {
    mockPlayedCache = [
      { id: ep.eid, type: 'EPISODE', title: ep.title, description: ep.description, podcast: ep.podcast },
      ...mockPlayedCache.filter((item) => item.id !== ep.eid),
    ].slice(0, 20)
    mockPlayedCacheVersion = new Date().toISOString()
  }
  return null
}

function handleEpisodePlayedListForCache(body: MockBody): unknown {
  const version = asString(body.version)
  // 带上本地游标且与服务端一致：缓存仍最新，不必重拉
  if (version && version === mockPlayedCacheVersion) {
    return { data: [], version: mockPlayedCacheVersion, needRefresh: false }
  }
  // 首次（无游标）或版本落后：返回完整快照 + 当前版本
  return { data: mockPlayedCache, version: mockPlayedCacheVersion, needRefresh: true }
}

function handleEpisodePlayedHistory(): unknown {
  return {
    data: [
      {
        episode: episodesByEid['mock-eid'],
        recentAudiences: [],
      },
    ],
  }
}

function handleCommentCreate(body: MockBody): { data: Comment } {
  const eid = asString(body.id, 'mock-eid')
  const base = (commentsByEpisode[eid] ?? commentsByEpisode['mock-eid'])[0]
  return {
    data: {
      ...base,
      id: `mock-new-comment-${Date.now()}`,
      text: asString(body.text, '（Mock 新评论）'),
      author: mockProfile as unknown as UserBasic,
      liked: false,
      collected: false,
      likeCount: 0,
      threadReplyCount: 0,
      pinned: false,
      level: 0,
      createdAt: new Date().toISOString(),
    },
  }
}

function handleCategoryPodcastList(body: MockBody): unknown {
  const categoryId = asString(body.categoryId, 'cat-arts')
  const tab = asString(body.tab, 'all')
  const items = categoryPodcasts[categoryId] ?? podcasts.slice(0, 6)
  const sorted =
    tab === 'hot'
      ? [...items].sort((a, b) => b.subscriptionCount - a.subscriptionCount)
      : tab === 'new'
        ? [...items].sort(
            (a, b) =>
              new Date(b.latestEpisodePubDate).getTime() - new Date(a.latestEpisodePubDate).getTime(),
          )
        : items
  return {
    data: sorted.map((podcast) => ({
      podcast,
      episode: episodesByPid[podcast.pid]?.[0] ?? null,
    })),
  }
}

function handleEditorPickHistory(body: MockBody): unknown {
  if (hasLoadMoreKey(body)) {
    return { data: editorPickHistory.slice(PAGE_SIZE.editorPicks) }
  }
  return {
    data: editorPickHistory.slice(0, PAGE_SIZE.editorPicks),
    loadMoreKey: 'mock-editor-pick-page-2',
  }
}

function handlePilotDiscovery(body: MockBody): unknown {
  const offset = hasLoadMoreKey(body) ? PAGE_SIZE.pilot : 0
  const page = pilotDiscovery.slice(offset, offset + PAGE_SIZE.pilot)
  const hasMore = offset + PAGE_SIZE.pilot < pilotDiscovery.length
  return {
    data: page.map((episode) => ({
      episode,
      recommendation: `编辑推荐：${episode.podcast.title} 的这一期值得收听。`,
    })),
    ...(hasMore ? { loadMoreKey: 'mock-pilot-page-2' } : {}),
  }
}

function handleSubscription(body: MockBody): unknown {
  const loadMoreKey = asRecord(body.loadMoreKey)
  const skip = typeof loadMoreKey.skip === 'number' ? loadMoreKey.skip : 0
  const page = subscriptions.slice(skip, skip + PAGE_SIZE.subscription)
  const nextSkip = skip + PAGE_SIZE.subscription
  return {
    data: page,
    ...(nextSkip < subscriptions.length ? { loadMoreKey: { skip: nextSkip } } : {}),
  }
}

function handleSubscriptionUpdate(body: MockBody): PodcastBasic {
  const pid = asString(body.pid, 'mock-pid')
  const mode = asString(body.mode, 'ON') === 'OFF' ? 'OFF' : 'ON'
  const base = podcastsByPid[pid] ?? podcasts[0]
  return { ...base, subscriptionStatus: mode }
}

/** 星标订阅：mock 内维护一份可变 Set，让「星标」tab 与星标切换能联动 */
const mockStarredPids = new Set(
  subscriptions.filter((podcast) => podcast.subscriptionStar).map((podcast) => podcast.pid),
)

function handleSubscriptionStar(): unknown {
  return { data: subscriptions.filter((podcast) => mockStarredPids.has(podcast.pid)) }
}

function handleSubscriptionStarUpdate(body: MockBody): unknown {
  const pid = asString(body.pid)
  if (pid) {
    if (body.withStar === true) mockStarredPids.add(pid)
    else mockStarredPids.delete(pid)
  }
  return {}
}

/** 收件箱分页数据（v1 / v2 共用）：按 loadMoreKey.id 找游标位置继续翻页 */
function buildInboxPage(body: MockBody): Record<string, unknown> {
  const loadMoreKey = asRecord(body.loadMoreKey)
  const cursorId = asString(loadMoreKey.id)
  const cursorIndex = cursorId
    ? inboxUpdates.findIndex((episode) => episode.eid === cursorId)
    : -1
  const offset = cursorIndex >= 0 ? cursorIndex + 1 : 0
  const page = inboxUpdates.slice(offset, offset + PAGE_SIZE.inbox)
  const last = page[page.length - 1]
  return {
    data: page,
    ...(last && offset + PAGE_SIZE.inbox < inboxUpdates.length
      ? { loadMoreKey: { pubDate: last.pubDate, id: last.eid } }
      : {}),
  }
}

function handleInboxList(body: MockBody): unknown {
  return buildInboxPage(body)
}

/** v2 收件箱：body `{limit?, loadMoreKey?}`，响应多一个 userStats（真实抓包结构） */
function handleInboxListV2(body: MockBody): unknown {
  return { ...buildInboxPage(body), userStats: { subscriptionCount: 9 } }
}

/** 首页 tab 流：第一页返回板块 + loadMoreKey，第二页（带 loadMoreKey）返回追加板块 */
function tabFeedPage(body: MockBody, first: unknown[], more: unknown[]): unknown {
  if (hasLoadMoreKey(body)) return { data: more }
  return { data: first, loadMoreKey: 'mock-tab-page-2' }
}

function handleTabFeatured(body: MockBody): unknown {
  return tabFeedPage(body, homeFeaturedSections, homeFeaturedMoreSections)
}

function handleTabDiscovery(body: MockBody): unknown {
  return tabFeedPage(body, homeDiscoverySections, homeDiscoveryMoreSections)
}

function handleTabCategory(body: MockBody): unknown {
  return tabFeedPage(body, homeCategorySections, homeCategoryMoreSections)
}

/** 相关单集：body `{eid}`，返回约 10 条（排除自己） */
function handleRelatedEpisodes(body: MockBody): unknown {
  const eid = asString(body.eid)
  return { data: relatedEpisodes.filter((episode) => episode.eid !== eid).slice(0, 10) }
}

/** 未读消息数：上游只有数量（{data:{unreadCount}}），内容没有接口 */
function handleUnreadCount(): unknown {
  return { data: { unreadCount: mockUnreadCount } }
}

/**
 * 互动通知：按 loadMoreKey.id 找游标位置继续翻页，返回真实后端形状
 * `{data:[notice], loadMoreKey:{id, createdAt}}`（上游 loadMoreKey 结构待抓包校准）。
 */
function handleNoticeList(body: MockBody): unknown {
  const loadMoreKey = asRecord(body.loadMoreKey)
  const cursorId = asString(loadMoreKey.id)
  const cursorIndex = cursorId
    ? noticeUpdates.findIndex((notice) => notice.id === cursorId)
    : -1
  const offset = cursorIndex >= 0 ? cursorIndex + 1 : 0
  const page = noticeUpdates.slice(offset, offset + PAGE_SIZE.notice)
  const last = page[page.length - 1]
  return {
    data: page,
    ...(last && offset + PAGE_SIZE.notice < noticeUpdates.length
      ? { loadMoreKey: { id: last.id, createdAt: last.createdAt } }
      : {}),
  }
}

function handlePrivateMediaGet(body: MockBody): unknown {
  const eid = asString(body.eid, 'mock-eid')
  const episode = episodesByEid[eid] ?? episodesByEid['mock-eid']
  return { data: { url: episode.enclosure.url, key: `mock-key-${eid}`, ttl: 3600 } }
}

function handleFavoriteEpisodeList(): unknown {
  return { data: favoriteEpisodes }
}

function handleCommentCollectList(): unknown {
  return { data: collectedComments }
}

function handleProfile(): unknown {
  return mockProfileResponse
}

function handleLogin(): unknown {
  return mockLoginResponse
}

function handleSendCode(): unknown {
  return {
    success: true,
    toast: '验证码已发送（Mock 环境：输入任意 4-6 位数字即可登录）',
  }
}

function handleRefreshToken(): unknown {
  return mockRefreshResponse
}

function handlePickRecent(): unknown {
  return { data: pickRecentItems }
}

function handlePodcastGetInfo(): unknown {
  return { data: mockPodcastGetInfo }
}

function handleEmpty(): unknown {
  return null
}

// ---------------------------------------------------------------------------
// 端点表
// ---------------------------------------------------------------------------

type MockHandler = (body: MockBody) => unknown

/**
 * 端点名 → handler。
 * 同时保留旧名字（部分端点历史上叫法不同），按路径最后一段匹配。
 */
const handlers: Record<string, MockHandler> = {
  sendCode: handleSendCode,
  login: handleLogin,
  refresh_token: handleRefreshToken,
  profile: handleProfile,
  discovery: handleDiscovery,
  top_list: handleTopList,
  editor_pick_list_history: handleEditorPickHistory,
  pilot_discovery_list: handlePilotDiscovery,
  podcast_detail: handlePodcastDetail,
  episode_list: handleEpisodeList,
  podcast_related: handlePodcastRelated,
  podcast_get_info: handlePodcastGetInfo,
  episode_detail: handleEpisodeDetail,
  episode_list_by_filter: handleEpisodeListByFilter,
  favorite_episode_update: (): unknown => null,
  favorite_episode_list: handleFavoriteEpisodeList,
  search: handleSearch,
  search_preset: handleSearchPreset,
  comment_primary: handleCommentPrimary,
  comment_thread: handleCommentThread,
  comment_list_thread_v2: handleCommentListThreadV2,
  comment_list_mine: handleMyComments,
  comment_list_timestamp_primary: handleTimestampComments,
  comment_get: handleCommentGet,
  ai_summary_episode_retrieve_brief: handleAISummary,
  episode_transcript_get: handleEpisodeTranscriptMeta,
  episode_transcript_content: handleEpisodeTranscriptContent,
  following_updates_list: handleFollowingUpdates,
  subscription_often_played: handleOftenPlayed,
  playback_progress_list: handlePlaybackProgressList,
  playback_progress_update: handlePlaybackProgressUpdate,
  episode_played_create: handleEpisodePlayedCreate,
  episode_played_history_list: handleEpisodePlayedHistory,
  episode_played_list_for_cache: handleEpisodePlayedListForCache,
  comment_create: handleCommentCreate,
  comment_like_update: handleEmpty,
  comment_remove: handleEmpty,
  comment_collect_create: handleEmpty,
  comment_collect_remove: handleEmpty,
  comment_collect_list: handleCommentCollectList,
  category_list: (): unknown => ({ data: categories }),
  category_list_tab: (body: MockBody): unknown => ({
    data: categoryTabs[asString(body.categoryId, 'cat-arts')] ?? [
      { id: 'all', name: '全部' },
      { id: 'hot', name: '热门' },
      { id: 'new', name: '最新' },
    ],
  }),
  category_podcast_list: handleCategoryPodcastList,
  subscription: handleSubscription,
  subscription_update: handleSubscriptionUpdate,
  subscription_star: handleSubscriptionStar,
  subscription_star_update: handleSubscriptionStarUpdate,
  inbox_list: handleInboxList,
  inbox_list_v2: handleInboxListV2,
  inbox_remove: handleEmpty,
  tab_featured_list: handleTabFeatured,
  tab_discovery_list: handleTabDiscovery,
  tab_category_list: handleTabCategory,
  related_episode_list: handleRelatedEpisodes,
  notice_list: handleNoticeList,
  unread_count: handleUnreadCount,
  // 与 api-engineer 对齐：pick_recent 已改名为 pick_list_recent，两个名字都兼容
  pick_list_recent: handlePickRecent,
  pick_recent: handlePickRecent,
  private_media_get: handlePrivateMediaGet,
}

/** 所有已实现端点名（供 adapter / mock server / README 使用） */
export const MOCK_ENDPOINT_LIST: string[] = Object.keys(handlers)

/** 是否是 mock 支持的端点 */
export function isMockEndpoint(endpointName: string): boolean {
  return Object.prototype.hasOwnProperty.call(handlers, endpointName)
}

/** 把请求解析成「拦截器之后」的 data；未实现的端点抛出带中文说明的错误。 */
export function resolveMockResponse(endpointName: string, body: MockBody = {}): unknown {
  const handler = handlers[endpointName]
  if (!handler) {
    throw new Error(`[mock] 未实现的端点：${endpointName}`)
  }
  return handler(body)
}

export default {
  MOCK_ENDPOINT_LIST,
  isMockEndpoint,
  resolveMockResponse,
  resolveEndpointName,
  resolveMockDelay,
  DEFAULT_MOCK_DELAY,
}
