import alova from '@/alova'
import { findField, unwrapList, unwrapPage } from '@/api/normalize'
import type { EpisodeBasic, PodcastBasic } from '@/api/types'

/**
 * 播放状态同步（真实抓包 2026-11-11，xyz 补丁新增 3 条代理路由）：
 * - `/playback_progress_list`   body `{eids:[...]}` → `{data:[{eid,pid,progress,playedAt}]}`
 * - `/playback_progress_update` body `{data:[{eid,pid,playedAt,progress}]}` → `{}`
 * - `/episode_played_create`    body `{eid}` → `{}`
 * - `/episode_played_history_list`（xyz 已有）body `{}` → `{data:[{episode, recentAudiences}], loadMoreKey}`
 *
 * 跨端合并由服务端按 `playedAt` 做最后写入优先；客户端只负责带准时间戳、在恢复时比较。
 */

export interface PlaybackProgressRecord {
  eid: string
  pid?: string
  progress: number
  playedAt: string
}

export const playbackProgressListAPI = (eids: string[]) =>
  alova
    .Post<unknown>('/playback_progress_list', { eids })
    .then((raw) => unwrapPage<PlaybackProgressRecord>(raw).items)

export interface PlaybackProgressUpdateInput {
  eid: string
  pid?: string
  playedAt: string
  progress: number
}

export const playbackProgressUpdateAPI = (data: PlaybackProgressUpdateInput[]) =>
  alova.Post<unknown>('/playback_progress_update', { data })

export const episodePlayedCreateAPI = (eid: string) =>
  alova.Post<unknown>('/episode_played_create', { eid })

/** 最近收听（按服务端时间倒序），用于找「上次听到哪一集」 */
export const episodePlayedHistoryAPI = () =>
  alova
    .Post<unknown>('/episode_played_history_list', {})
    .then((raw) =>
      unwrapPage<{ episode?: EpisodeBasic }>(raw).items
        .map((item) => item.episode)
        .filter((episode): episode is EpisodeBasic => Boolean(episode?.eid)),
    )

/**
 * 最近收听「本地缓存增量同步」（真实抓包 2026-11-11，对齐 App 3.4.2）：
 * 上游 `POST /v1/episode-played/list-for-cache`，xyz 代理 `/episode_played_list_for_cache`。
 * - 请求 `{version?, loadMoreKey?}`：首次不带 version；之后带上本地存的上次快照版本。
 * - 响应 `{data: PlayedHistory[], version, needRefresh, loadMoreKey?}`：
 *   data 是当前「最近收听」的完整快照（条目用 id 而非 eid），version 是快照版本（ISO 时间戳），
 *   needRefresh 告知本地缓存是否过期需要整体替换。版本没变时 needRefresh=false，不必重拉。
 *
 * 注意：这里只同步「收听过哪些单集」的列表，播放进度另走 playback_progress_list。
 */
export interface PlayedHistoryItem {
  id: string
  type: string
  title: string
  description?: string
  podcast?: PodcastBasic
}

export interface PlayedCacheResult {
  items: PlayedHistoryItem[]
  version?: string
  needRefresh: boolean
  loadMoreKey?: unknown
}

export const episodePlayedCacheAPI = (
  version?: string,
  loadMoreKey?: unknown,
): Promise<PlayedCacheResult> =>
  alova
    .Post<unknown>('/episode_played_list_for_cache', {
      ...(version ? { version } : {}),
      ...(loadMoreKey === undefined ? {} : { loadMoreKey }),
    })
    .then((raw) => ({
      items: unwrapList<PlayedHistoryItem>(raw),
      version: findField<string>(raw, 'version'),
      needRefresh: findField<boolean>(raw, 'needRefresh') ?? false,
      loadMoreKey: findField(raw, 'loadMoreKey'),
    }))
