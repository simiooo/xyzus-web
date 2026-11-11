import alova from '@/alova'
import { findField, unwrapData, unwrapPage } from '@/api/normalize'
import type {
  EpisodeAudioSource,
  EpisodeBasic,
  EpisodeDetail,
  EpisodeDetailParams,
  EpisodeListByFilterParams,
  EpisodeListParams,
  EpisodeListResult,
  FavoriteEpisodeUpdateParams,
  PageResult,
  PrivateMediaSource,
} from '@/api/types'

/**
 * 单集接口契约（来源：D:\work\xyz-backend\handlers\episode.go、private.go、favorite.go、doc\docs\*.md）：
 * - `/episode_detail`：body `{eid}`；上游 body `{data:<episode>}`。
 * - `/episode_list`：body `{pid, order:"asc"|"desc", loadMoreKey?:{pubDate,id,direction}}`；
 *   上游 body `{data:[...episodes], loadMoreKey?, total}`。
 * - `/episode_list_by_filter`：后端只要求 `{pid}`（旧客户端多传的 filter 会被 Go 忽略）。
 * - `/favorite_episode_list`：body 空，**不支持分页**（后端 `FavoriteEpisodeList` 收到空 map，
 *   上游 `/v1/favorite/list` 也无分页参数）→ 返回全量 `EpisodeBasic[]`，页面自行分批渐显。
 * - `/private_media_get`：body `{eid}`；上游 GET `/v1/private-media/get?dubbing=false&eid=`，
 *   响应 body `{data:{url,key,ttl}}`。付费/私密单集的 `media.source.url` 可能是 null，用它兜底。
 */

export const episodeDetailAPI = (params: EpisodeDetailParams) =>
  alova.Post<unknown>('/episode_detail', params).then((raw) => unwrapData<EpisodeDetail>(raw))

export const episodeListAPI = (params: EpisodeListParams) =>
  alova.Post<unknown>('/episode_list', params).then((raw) => {
    const page = unwrapPage<EpisodeBasic, NonNullable<EpisodeListParams['loadMoreKey']>>(raw)
    const result: EpisodeListResult = { items: page.items }
    if (page.loadMoreKey !== undefined) result.loadMoreKey = page.loadMoreKey
    if (page.totalCount !== undefined) result.total = page.totalCount
    const order = findField<string>(raw, 'order')
    if (order !== undefined) result.order = order
    return result
  })

export const episodeListByFilterAPI = (params: EpisodeListByFilterParams) =>
  alova
    .Post<unknown>('/episode_list_by_filter', { pid: params.pid })
    .then((raw) => unwrapPage<EpisodeBasic>(raw).items)

export const favoriteEpisodeUpdateAPI = (params: FavoriteEpisodeUpdateParams) =>
  alova.Post<unknown>('/favorite_episode_update', params)

export const favoriteEpisodeListAPI = () =>
  alova
    .Post<PageResult<EpisodeBasic>>('/favorite_episode_list')
    .then((raw) => unwrapPage<EpisodeBasic>(raw).items)

/** 查询付费/私密单集的音频地址（需要已登录 + 已在小宇宙 App 内购买该单集）。 */
export const privateMediaGetAPI = (eid: string) =>
  alova
    .Post<unknown>('/private_media_get', { eid })
    .then((raw) => unwrapData<PrivateMediaSource>(raw))

/**
 * 相关单集推荐（真实抓包 2026-11-11）：
 * `POST /related_episode_list` body `{eid}` → 上游 `/v1/related-episode/list`；
 * 响应 `{data: Episode[]}`（约 10 条，跨节目推荐）。xyz 端点在后端补丁里。
 */
export const relatedEpisodeListAPI = (eid: string) =>
  alova
    .Post<unknown>('/related_episode_list', { eid })
    .then((raw) => unwrapPage<EpisodeBasic>(raw).items)

/**
 * 单集 AI 摘要（真实抓包 2026-11-11）：
 * `POST /ai_summary_episode_retrieve_brief` body `{eid}` → 上游 `/v1/ai-summary/episode/retrieve-brief`；
 * 响应 `{requested, summary:{status:"ready", brief, ...}|null, confirmation}`。
 * 不是每集都有摘要、且上游有频率限制（429），拿不到时返回 null，页面不要报错。
 */
export interface EpisodeAISummary {
  status?: string
  brief?: string
}

export const episodeAISummaryAPI = (eid: string) =>
  alova.Post<unknown>('/ai_summary_episode_retrieve_brief', { eid }).then((raw) => {
    const data = unwrapData<{ summary?: EpisodeAISummary | null }>(raw)
    const summary = data?.summary
    if (!summary || summary.status !== 'ready' || !summary.brief) return null
    return summary
  })

/** 单集文字稿元数据：返回 CDN 上的签名地址（正文用 /episode_transcript_content 代理取） */
export interface EpisodeTranscriptMeta {
  key?: string
  vendorDeclaration?: string
  transcriptUrl?: string
  highlightUrl?: string
}

export const episodeTranscriptAPI = (eid: string, mediaId: string) =>
  alova
    .Post<unknown>('/episode_transcript_get', { eid, mediaId })
    .then((raw) => unwrapData<EpisodeTranscriptMeta>(raw))

/** 文字稿正文的一段（真实 CDN JSON 是 `[{text, startMs}]`） */
export interface TranscriptSegment {
  text: string
  startMs: number
}

export const episodeTranscriptContentAPI = (transcriptUrl: string) =>
  alova
    .Post<unknown>('/episode_transcript_content', { url: transcriptUrl })
    .then((raw) => unwrapData<TranscriptSegment[]>(raw))

/**
 * 解析单集可播放地址：先取公开/备份/ enclosure，取不到再走 `/private_media_get` 兜底。
 * 永远不 reject：拿不到时返回 `{url:null, reason}`，UI 负责给中文失败提示并暂停播放。
 *
 * 使用位置：`src/components/AudioPlayer.tsx` 换源时调用（播放器是唯一持有 <audio> 的地方）。
 */
export async function resolveEpisodeAudioUrl(
  episode: Pick<EpisodeBasic, 'eid' | 'media' | 'enclosure' | 'isPrivateMedia'>,
): Promise<EpisodeAudioSource> {
  const candidates = [
    episode.media?.source?.url,
    episode.media?.backupSource?.url,
    episode.enclosure?.url,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && /^https?:\/\//.test(candidate)) {
      return { url: candidate }
    }
  }

  try {
    const source = await privateMediaGetAPI(episode.eid)
    if (source?.url && /^https?:\/\//.test(source.url)) {
      return { url: source.url }
    }
    return { url: null, reason: 'PRIVATE_MEDIA_UNAVAILABLE' }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    // 401（未登录/token 失效）与接口业务错误（未购买/无权限）都按「需在小宇宙 App 购买或登录」处理
    if (message.includes('网络')) return { url: null, reason: 'FETCH_FAILED' }
    return { url: null, reason: 'PRIVATE_MEDIA_UNAVAILABLE' }
  }
}
