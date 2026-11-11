import alova from '@/alova'
import { unwrapData, unwrapPage } from '@/api/normalize'
import type {
  PodcastBasic,
  PodcastRelatedItem,
  EpisodeListParams,
  EpisodeListResult,
  EpisodeBasic,
  PageResult,
} from '@/api/types'

/**
 * 节目接口契约（来源：D:\work\xyz-backend\handlers\podcast.go、episode.go、doc\docs\*.md）：
 * - `/podcast_detail`：body `{pid}`；上游 body `{data:<podcast>}`。
 * - `/episode_list`：body `{pid, order, loadMoreKey?}`；上游 body `{data:[...], loadMoreKey?, total}`。
 * - `/podcast_related`：body `{pid}`；上游 body `{data:[{podcast:<podcast>, …}]}`。
 * - `/podcast_get_info`：body `{pid}`；上游 body `{data:{ipLoc,organization,…}}`。
 */

export const podcastDetailAPI = (pid: string) =>
  alova.Post<unknown>('/podcast_detail', { pid }).then((raw) => unwrapData<PodcastBasic>(raw))

export const podcastRelatedAPI = (params: { pid: string }) =>
  alova.Post<unknown>('/podcast_related', params).then((raw) =>
    unwrapPage<PodcastRelatedItem>(raw).items.map((entry) => {
      if (entry && typeof entry === 'object' && 'podcast' in entry) return entry
      return { podcast: entry as unknown as PodcastBasic }
    }),
  )

export const podcastGetInfoAPI = (pid: string) =>
  alova
    .Post<unknown>('/podcast_get_info', { pid })
    .then((raw) => unwrapData<{ ipLoc?: string; organization?: string }>(raw))

/** 节目内单集列表（节目详情页用；与 episode.ts 的 episodeListAPI 同一后端端点）。 */
export const episodeListAPI = (params: EpisodeListParams): Promise<EpisodeListResult> =>
  alova.Post<unknown>('/episode_list', params).then((raw) => {
    const page = unwrapPage<EpisodeBasic, NonNullable<EpisodeListParams['loadMoreKey']>>(raw)
    const result: EpisodeListResult = { items: page.items, total: page.totalCount }
    if (page.loadMoreKey !== undefined) result.loadMoreKey = page.loadMoreKey
    return result
  })

export type { PageResult }
