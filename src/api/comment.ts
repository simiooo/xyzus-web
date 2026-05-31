import alova from '@/alova'
import type {
  Comment,
  CommentPrimaryParams,
  CommentPrimaryLoadMoreKey,
  CommentThreadParams,
  CommentCreateParams,
  CommentLikeUpdateParams,
  CommentRemoveParams,
  CommentCollectCreateParams,
  CommentCollectRemoveParams,
} from '@/api/types'

export const commentPrimaryAPI = (params: CommentPrimaryParams) =>
  alova.Post<{ data: Comment[]; loadMoreKey?: CommentPrimaryLoadMoreKey; totalCount?: number }>('/comment_primary', params)

export const commentThreadAPI = (params: CommentThreadParams) =>
  alova.Post<{ data: Comment[] }>('/comment_thread', params)

export const commentCreateAPI = (params: CommentCreateParams) =>
  alova.Post<Comment>('/comment_create', params)

export const commentLikeUpdateAPI = (params: CommentLikeUpdateParams) =>
  alova.Post<null>('/comment_like_update', params)

export const commentRemoveAPI = (params: CommentRemoveParams) =>
  alova.Post<null>('/comment_remove', params)

export const commentCollectCreateAPI = (params: CommentCollectCreateParams) =>
  alova.Post<null>('/comment_collect_create', params)

export const commentCollectRemoveAPI = (params: CommentCollectRemoveParams) =>
  alova.Post<null>('/comment_collect_remove', params)

export const commentCollectListAPI = () =>
  alova.Post<Comment[]>('/comment_collect_list')
