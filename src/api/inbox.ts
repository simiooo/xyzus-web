import alova from '@/alova'
import { findField, unwrapPage } from '@/api/normalize'
import type { EpisodeBasic } from '@/api/types'

/**
 * 收件箱 / 未读接口契约（真实抓包 2026-11-11，小宇宙 App 3.4.2）：
 *
 * - `POST /inbox_list_v2` → 上游 `/v2/inbox/list`
 *   body `{limit:25, loadMoreKey?:{pubDate,id}}`
 *   响应 `{data: Episode[], userStats:{subscriptionCount}, loadMoreKey?:{pubDate,id}}`
 *   App 3.4.2 用的是 v2（旧 v1 仍可用，但 v2 支持 limit 与同样的游标分页）。
 * - `POST /inbox_remove` → 上游 `/v1/inbox/remove`
 *   body `{eids: string[]}`，响应 `{}`；App 在收件箱「已读/清空」时批量传所有 eid。
 * - `POST /unread_count` → 上游 `/v1/unread-count/get`，只有数字（互动通知未读）。
 *
 * 条目是「订阅的节目更新」的单集（`type:"EPISODE"`，内嵌 podcast），可直接交给 EpisodeRow。
 */

/** 收件箱分页游标，由接口原样返回、原样回传 */
export interface InboxLoadMoreKey {
  pubDate: string
  id: string
}

export interface InboxParams {
  loadMoreKey?: InboxLoadMoreKey
  limit?: number
}

export interface InboxPageResult {
  items: EpisodeBasic[]
  loadMoreKey?: InboxLoadMoreKey
}

const DEFAULT_LIMIT = 25

export const inboxListAPI = (params?: InboxParams) =>
  alova
    .Post<unknown>('/inbox_list_v2', {
      limit: params?.limit ?? DEFAULT_LIMIT,
      ...(params?.loadMoreKey !== undefined ? { loadMoreKey: params.loadMoreKey } : {}),
    })
    .then((raw): InboxPageResult => {
      const page = unwrapPage<EpisodeBasic, InboxLoadMoreKey>(raw)
      return {
        items: page.items,
        ...(page.loadMoreKey !== undefined ? { loadMoreKey: page.loadMoreKey } : {}),
      }
    })

/** 收件箱「全部已读」：批量把单集从收件箱移除（App 的真实做法） */
export const inboxRemoveAPI = (eids: string[]) =>
  alova.Post<unknown>('/inbox_remove', { eids })

/** 未读消息数（互动通知）；拿不到或字段缺失时按 0 处理，不打扰页面。 */
export const unreadCountAPI = () =>
  alova.Post<unknown>('/unread_count').then((raw) => {
    const count = findField<number>(raw, 'unreadCount')
    return typeof count === 'number' && Number.isFinite(count) && count > 0
      ? Math.floor(count)
      : 0
  })
