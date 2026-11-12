import alova from '@/alova'
import { unwrapData, unwrapPage } from '@/api/normalize'
import type { PickRecentItem, PickRecentParams, UserProfile } from '@/api/types'

/**
 * 用户接口契约（来源：D:\work\xyz-backend\handlers\profile.go、pick.go + doc\docs\pickRecent.md）：
 * - `/profile`：POST 空 body；上游 body `{data:<user>}` → 归一化成裸 `UserProfile`。
 * - `/pick_list_recent`：body `{uid}`。**旧客户端写的 `/pick_recent` 路由不存在（后端 404）**，
 *   真实路由是 `/pick_list_recent`（上游 /v1/pick/list-recent）；上游 body `{data:[{id,type:"PICK",story,pickedAt,episode,…}]}`。
 */

export const getProfileAPI = () =>
  alova.Post<unknown>('/profile').then((raw) => unwrapData<UserProfile>(raw))

/** 用户统计数据（/user_stats，body `{uid}`）：粉丝 / 关注 / 订阅数 + 总收听秒数。 */
export interface UserStats {
  followerCount: number
  followingCount: number
  subscriptionCount: number
  totalPlayedSeconds: number
}

export const userStatsAPI = (uid: string) =>
  alova.Post<unknown>('/user_stats', { uid }).then((raw) => unwrapData<UserStats>(raw))

export const pickRecentAPI = (params: PickRecentParams) =>
  alova
    .Post<PickRecentItem[]>('/pick_list_recent', params)
    .then((raw) => unwrapPage<PickRecentItem>(raw).items)
