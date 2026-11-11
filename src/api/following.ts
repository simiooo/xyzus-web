import alova from '@/alova'
import { findField, unwrapPage } from '@/api/normalize'
import type { EpisodeBasic, UserBasic } from '@/api/types'

/**
 * 关注动态（真实抓包 2026-11-11；实际是 **POST**、body `{}`，不是 GET）：
 * `POST /following_updates_list` → 上游 `/v1/personal-update/list-following-updates`，
 * 响应 `{data: [{id, actionType:"PICK", item:{user, episode, story, pickedAt, ...}}], showSticker}`。
 */
export interface FollowingUpdateItem {
  id?: string
  type?: string
  story?: { emotion?: string; text?: string; iconUrl?: string }
  episode?: EpisodeBasic
  user?: UserBasic
  pickedAt?: string
  likeCount?: number
  commentCount?: number
  isLiked?: boolean
}

export interface FollowingUpdate {
  id: string
  actionType?: string
  item?: FollowingUpdateItem
}

export interface FollowingUpdatesResult {
  items: FollowingUpdate[]
  showSticker: boolean
}

export const followingUpdatesListAPI = () =>
  alova.Post<unknown>('/following_updates_list', {}).then((raw) => {
    const page = unwrapPage<FollowingUpdate>(raw)
    return {
      items: page.items,
      showSticker: Boolean(findField<boolean>(raw, 'showSticker')),
    } satisfies FollowingUpdatesResult
  })
