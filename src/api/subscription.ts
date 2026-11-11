import alova from '@/alova'
import { unwrapPage } from '@/api/normalize'
import type { PageResult, PodcastBasic } from '@/api/types'

/**
 * 订阅接口契约（来源：D:\work\xyz-backend\handlers\subscription.go + doc\docs\subscription.md）：
 * - `/subscription`：body `{uid?, loadMoreKey?:{skip:number}}`；上游 body `{data:[...podcasts], loadMoreKey?}`
 *   （个别版本出现过 `{data:{data:[...],loadMoreKey}}` 双层包裹，normalize 两种都吃）。
 * - `/subscription_update`：body `{pid, mode:"ON"|"OFF"}`。
 */

export interface SubscriptionLoadMoreKey {
  skip: number
}

export interface SubscriptionParams {
  uid?: string
  loadMoreKey?: SubscriptionLoadMoreKey
}

export const subscriptionListAPI = (params?: SubscriptionParams) =>
  alova
    .Post<PageResult<PodcastBasic, SubscriptionLoadMoreKey>>('/subscription', params || {})
    .then((raw) => unwrapPage<PodcastBasic, SubscriptionLoadMoreKey>(raw))

export const subscriptionUpdateAPI = (pid: string, mode: 'ON' | 'OFF') =>
  alova.Post<unknown>('/subscription_update', { pid, mode })

/**
 * 星标订阅列表（xyz 已有端点，真实抓包核对：POST body 空 → 上游 `/v1/subscription-star/list`，
 * 返回 `{data: PodcastBasic[]}`，无分页）。订阅页「星标」tab 使用。
 */
export const starredSubscriptionListAPI = () =>
  alova.Post<unknown>('/subscription_star', {}).then((raw) => unwrapPage<PodcastBasic>(raw).items)

/** 星标 / 取消星标（body `{pid, withStar}` → 上游 `/v1/subscription-star/update`） */
export const starSubscriptionUpdateAPI = (pid: string, withStar: boolean) =>
  alova.Post<unknown>('/subscription_star_update', { pid, withStar })

/**
 * 常听节目（真实抓包 2026-11-11）：body `{limit:25}` → 上游 `/v1/subscription/list-often-played`，
 * 返回 `{data: PodcastBasic[]}`。订阅页顶部「常听节目」货架使用，失败时静默隐藏。
 */
export const oftenPlayedListAPI = (limit = 5) =>
  alova
    .Post<unknown>('/subscription_often_played', { limit })
    .then((raw) => unwrapPage<PodcastBasic>(raw).items)
