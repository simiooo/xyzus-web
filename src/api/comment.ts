import alova from '@/alova'
import { unwrapData, unwrapPage } from '@/api/normalize'
import type {
  Comment,
  CommentPageResult,
  CommentPrimaryParams,
  CommentPrimaryLoadMoreKey,
  CommentThreadParams,
  CommentCreateParams,
  CommentLikeUpdateParams,
  CommentRemoveParams,
  CommentCollectCreateParams,
  CommentCollectRemoveParams,
  EpisodeBasic,
} from '@/api/types'

/**
 * 评论接口契约（来源：D:\work\xyz-backend\handlers\comment.go + 真实抓包 2026-11-11）：
 * - `/comment_primary`：body **必须**是 `{owner:{id:<eid>,type:"EPISODE"}, order, loadMoreKey?}`。
 *   旧客户端发 `{id, order}` 会被后端 ReturnBadRequest → HTTP 400「错误请求」，评论 100% 挂。
 * - `/comment_list_thread_v2`：body `{primaryCommentId, order:"SMART"}` → `{data, totalCount}`（真实抓包）。
 * - `/comment_list_mine`：body `{order:"TIME"|"LIKE", limit}` → `{data:[Comment+episode]}`（真实抓包）。
 * - `/comment_list_timestamp_primary`：body `{owner:{id:eid,type:"EPISODE"}, from, to}` → `{data}`（真实抓包）。
 * - `/comment_collect_list`：body 空；真实返回 `{data:[...], loadMoreKey}`（旧类型写成 Comment[] 是错的）。
 * 所有列表统一归一化成 `{items, loadMoreKey?}`。
 */

export const commentPrimaryAPI = (params: CommentPrimaryParams) =>
  alova
    .Post<CommentPageResult>('/comment_primary', {
      owner: { id: params.id, type: 'EPISODE' as const },
      order: params.order,
      ...(params.loadMoreKey ? { loadMoreKey: params.loadMoreKey } : {}),
    })
    .then((raw) => unwrapPage<Comment, CommentPrimaryLoadMoreKey>(raw))

/** 回复评论 v2（真实抓包：order 固定 "SMART"；响应含 totalCount，归一化后取 data） */
export const commentThreadAPI = (params: CommentThreadParams) =>
  alova
    .Post<CommentPageResult>('/comment_list_thread_v2', params)
    .then((raw) => unwrapPage<Comment, string>(raw))

/** 我的评论（带 episode，页面可直接展示/跳转） */
export interface MyComment extends Comment {
  episode?: EpisodeBasic
}

export type MyCommentOrder = 'TIME' | 'LIKE'

export interface MyCommentParams {
  order: MyCommentOrder
  limit?: number
}

export const myCommentListAPI = (params: MyCommentParams) =>
  alova
    .Post<unknown>('/comment_list_mine', { order: params.order, limit: params.limit ?? 20 })
    .then((raw) => unwrapPage<MyComment>(raw).items)

/** 按 id 取单条评论（时点标记 → 评论正文；上游 GET `/v1/comment/get?commentId=`） */
export const commentGetAPI = (commentId: string) =>
  alova.Post<unknown>('/comment_get', { commentId }).then((raw) => unwrapData<Comment>(raw))

/** 时点评论标记（/comment_list_timestamp_primary，真实抓包 2026-11-11）：
 * 返回的是**时点标记**而不是评论本体，`{id, timestamp, type}`，id 指向具体评论；
 * 时点面板（点开某分钟看评论）留到后续批次实现，这里先把接口契约固定下来。
 */
export interface TimestampCommentRef {
  id: string
  /** 在音频中的秒数 */
  timestamp: number
  type?: string
}

export const commentTimestampPrimaryAPI = (params: { eid: string; from: number; to: number }) =>
  alova
    .Post<unknown>('/comment_list_timestamp_primary', {
      owner: { id: params.eid, type: 'EPISODE' as const },
      from: params.from,
      to: params.to,
    })
    .then((raw) => unwrapPage<TimestampCommentRef>(raw).items)

export const commentCollectListAPI = () =>
  alova.Post<CommentPageResult>('/comment_collect_list').then((raw) => unwrapPage<Comment, string>(raw))

/** 创建评论：id 传**单集 eid**（后端映射 owner），回复时 replyToCommentId 传被回复评论 id。 */
export const commentCreateAPI = (params: CommentCreateParams) =>
  alova.Post<unknown>('/comment_create', params).then((raw) => unwrapData<Comment>(raw))

export const commentLikeUpdateAPI = (params: CommentLikeUpdateParams) =>
  alova.Post<unknown>('/comment_like_update', params)

export const commentRemoveAPI = (params: CommentRemoveParams) =>
  alova.Post<unknown>('/comment_remove', params)

export const commentCollectCreateAPI = (params: CommentCollectCreateParams) =>
  alova.Post<unknown>('/comment_collect_create', params)

export const commentCollectRemoveAPI = (params: CommentCollectRemoveParams) =>
  alova.Post<unknown>('/comment_collect_remove', params)
