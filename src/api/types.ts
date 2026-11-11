export interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

export interface ImageUrls {
  picUrl: string
  largePicUrl: string
  middlePicUrl: string
  smallPicUrl: string
  thumbnailUrl: string
  format?: string
  width?: number
  height?: number
}

export interface UserBasic {
  type: 'USER'
  uid: string
  avatar: { picture: ImageUrls }
  nickname: string
  isNicknameSet: boolean
  bio?: string
  gender?: 'MALE' | 'FEMALE'
  isCancelled: boolean
  readTrackInfo: Record<string, unknown>
  ipLoc?: string
  relation: 'STRANGE' | 'FOLLOWING'
  isBlockedByViewer: boolean
}

export interface PodcastBasic {
  type: 'PODCAST'
  pid: string
  title: string
  author: string
  brief?: string
  description: string
  subscriptionCount: number
  image: ImageUrls
  color: { original: string; light: string; dark: string }
  topicLabels: string[]
  syncMode: string
  episodeCount: number
  latestEpisodePubDate: string
  subscriptionStatus: 'ON' | 'OFF'
  subscriptionPush: boolean
  subscriptionPushPriority: string
  subscriptionStar: boolean
  status: 'NORMAL' | string
  permissions: { name: string; status: string }[]
  payType: 'FREE' | string
  payEpisodeCount: number
  podcasters: UserBasic[]
  readTrackInfo: Record<string, unknown>
  hasPopularEpisodes: boolean
  contacts: { type: string; name: string; note?: string; url?: string }[]
  isCustomized: boolean
  playTime?: number
  showZhuiguangIcon?: boolean
}

export interface EpisodeBasic {
  type: 'EPISODE'
  eid: string
  pid: string
  title: string
  shownotes?: string
  description: string
  image?: ImageUrls
  enclosure: { url: string }
  isPrivateMedia: boolean
  mediaKey: string
  media: {
    id: string
    size: number
    mimeType: string
    /** 付费/私密单集上游可能给 null（需要 /private_media_get 兜底），见 resolveEpisodeAudioUrl */
    source: { mode: string; url: string | null }
    /** 部分单集只有备份源 */
    backupSource?: { mode: string; url: string }
  }
  clapCount: number
  commentCount: number
  playCount: number
  favoriteCount: number
  pubDate: string
  status: string
  duration: number
  podcast: PodcastBasic
  isPlayed: boolean
  isFinished: boolean
  isPicked: boolean
  isFavorited: boolean
  permissions: { name: string; status: string }[]
  payType: string
  labels: { name: string; code: string }[]
  sponsors: unknown[]
  isCustomized: boolean
  ipLoc?: string
}

export interface EpisodeDetail extends EpisodeBasic {
  transcript: { mediaId: string }
  transcriptMediaId: string
  listedInEditorPickAt: string[]
  wechatShare: { style: string }
}

export interface Comment {
  id: string
  type: 'COMMENT'
  owner: { id: string; type: string }
  thread?: string
  author: UserBasic
  authorAssociation: string
  text: string
  level: number
  likeCount: number
  liked: boolean
  collected: boolean
  createdAt: string
  status: string
  permissions: { name: string; status: string }[]
  pid: string
  pinned: boolean
  isAuthorMuted: boolean
  entities: unknown[]
  badges: unknown[]
  ipLoc?: string
  threadReplyCount?: number
  replies?: Comment[]
  replyToComment?: Comment
}

export interface DiscoveryResponse {
  data: DiscoveryRawSection[]
  loadMoreKey?: string
}

export interface DiscoveryRawSection {
  type: string
  data: unknown
}

export interface EpisodeRecommendTarget {
  episode: EpisodeBasic
  recommendation?: string
}

export interface EditorPickItem {
  episode: EpisodeBasic
  comment?: Comment
}

/**
 * 登录响应（alova 拦截器剥掉后端信封之后）：token 在顶层，
 * 用户信息在 `data`（xyz `handlers/login.go` 里是 `data.data = user`）。
 */
export interface LoginResponse {
  'x-jike-access-token': string
  'x-jike-refresh-token': string
  data?: UserProfile
}

export interface UserProfile {
  type: 'USER'
  uid: string
  nickname: string
  isNicknameSet: boolean
  avatar: { picture: ImageUrls }
  bio?: string
  gender?: 'MALE' | 'FEMALE'
  isCancelled: boolean
  ipLoc?: string
  birthYear?: number
  industry?: string
  certifications?: { kind: string; shows: { title: string }[] }[]
  createdAt?: string
  phoneNumber?: { mobilePhoneNumber: string; areaCode: string }
  isInvited?: boolean
}

export interface SendCodeParams {
  mobilePhoneNumber: string
  areaCode: string
}

export interface LoginParams {
  mobilePhoneNumber: string
  verifyCode: string
  areaCode: string
}

export interface RefreshTokenParams {
  'x-jike-access-token': string
  'x-jike-refresh-token': string
}

export interface DiscoveryParams {
  loadMoreKey?: string
}

export interface TopListParams {
  category: 'HOT' | 'ROCK' | 'NEW'
}

export interface CursorKey {
  direction: 'NEXT' | 'PREV'
  id: string
  pubDate: string
}

export interface EpisodeListParams {
  pid: string
  order?: 'asc' | 'desc'
  loadMoreKey?: CursorKey
}

export interface EpisodeListResponse {
  data: EpisodeBasic[]
  loadMoreKey?: CursorKey
  loadNextKey?: CursorKey
  order?: string
  total?: number
}

export interface PodcastRelatedItem {
  podcast: PodcastBasic
}

export interface PodcastRelatedParams {
  pid: string
}

export interface EpisodeDetailParams {
  eid: string
}

export interface EpisodeListByFilterParams {
  pid: string
  filter: string
}

export interface PaginatedData<T> {
  items: T[]
  loadMoreKey?: string
}

export interface FavoriteEpisodeUpdateParams {
  eid: string
  favorited: boolean
}

export type SearchLoadMoreKey = string | { loadMoreKey: number; searchId: string }

export interface SearchParams {
  keyword: string
  type: 'ALL' | 'PODCAST' | 'EPISODE' | 'USER'
  loadMoreKey?: SearchLoadMoreKey
  pid?: string
}

export interface SearchPresetItem {
  type: 'FIXED'
  text: string
  link: string
  resident: boolean
  readTrackInfo?: Record<string, unknown>
}

export type SearchRawItem =
  | { type: 'HEADER'; title: string; link?: string; readTrackInfo?: Record<string, unknown> }
  | PodcastBasic
  | EpisodeBasic
  | UserBasic
  | { type: 'FOOTER'; title: string; link: string; readTrackInfo?: Record<string, unknown> }
  | { type: 'SEARCHED_USERS'; users: UserBasic[]; readTrackInfo?: Record<string, unknown> }

export interface SearchResponse {
  data: SearchRawItem[]
  loadMoreKey?: SearchLoadMoreKey
  highlightWord?: {
    words: string[]
    singleMaxHighlightTime: number
  }
}

export interface CommentPrimaryParams {
  /** 单集 eid（api 层内部会拼成后端要求的 `owner:{id,type:'EPISODE'}`） */
  id: string
  order: 'HOT' | 'TIME' | 'TIMESTAMP'
  loadMoreKey?: CommentPrimaryLoadMoreKey
}

export interface CommentPrimaryLoadMoreKey {
  direction: string
  hotSortScore: number
  id: string
  /** 时点评论（TIMESTAMP）时上游要求带 section */
  section?: string
}

export interface CommentThreadParams {
  primaryCommentId: string
  order: 'SMART' | 'TIME'
  loadMoreKey?: string
}

export interface CommentCreateParams {
  id: string
  type: 'EPISODE'
  text: string
  replyToCommentId?: string
}

export interface CommentLikeUpdateParams {
  id: string
  liked: boolean
  type: 'COMMENT' | 'PICK'
}

export interface CommentRemoveParams {
  commentId: string
}

export interface CommentCollectCreateParams {
  commentId: string
}

export interface CommentCollectRemoveParams {
  commentId: string
}

export interface CategoryParams {
  categoryId: string
  tab?: string
  /** 后端 `CategoryPodcastListByTabRequestBody.LoadMoreKey` 是 int */
  loadMoreKey?: number
}

export interface PickRecentParams {
  uid: string
}

export interface EditorPickListHistoryParams {
  loadMoreKey?: string
}

export interface PilotDiscoveryListParams {
  loadMoreKey?: string
}

/* ------------------------------------------------------------------ *
 * 干净返回类型（api 层归一化之后的结果，页面只看这些）
 * ------------------------------------------------------------------ */

/**
 * 分页列表统一形状：页面一律拿 `{ items, loadMoreKey? }`。
 * 上游/后端各种 `{data:[...]}`、`{data:{data:[...]}}`、`{data:{items:[...]}}`
 * 的包裹层由 `src/api/normalize.ts` 的 `unwrapPage` 吃掉。
 */
export interface PageResult<T, K = unknown> {
  items: T[]
  loadMoreKey?: K
  totalCount?: number
}

export interface SearchPageResult extends PageResult<SearchRawItem, SearchLoadMoreKey> {
  highlightWord?: {
    words: string[]
    singleMaxHighlightTime: number
  }
}

export type CommentPageResult = PageResult<Comment, CommentPrimaryLoadMoreKey>

export interface EpisodeListResult extends PageResult<EpisodeBasic, CursorKey> {
  order?: string
  total?: number
}

export interface EditorPickGroup {
  date: string
  dateIsoStr?: string
  picks: EditorPick[]
}

export interface EditorPick {
  episode: EpisodeBasic
  comment?: Comment
}

/** /pick_list_recent 的“用户的喜欢”条目 */
export interface PickRecentItem {
  id: string
  type: 'PICK'
  story?: {
    text: string
    emotion: string
    iconUrl?: string
  }
  pickedAt: string
  episode: EpisodeBasic
  user?: UserBasic
  likeCount?: number
  commentCount?: number
  isLiked?: boolean
  readTrackInfo?: Record<string, unknown>
}

/** /sendCode 的上游返回（风控失败时是 {success:false, code:1003, toast}） */
export interface SendCodeResult {
  success?: boolean
  code?: number
  toast?: string
  [key: string]: unknown
}

/** /private_media_get 的干净返回 */
export interface PrivateMediaSource {
  url: string
  key?: string
  ttl?: number
}

/** 登录/粘贴 token 之后的会话聚合结果 */
export interface LoginSession {
  accessToken: string
  refreshToken: string
  user: UserProfile | null
}

/** 单集播放地址解析结果（付费/私密单集兜底后仍取不到 URL 时给 reason） */
export interface EpisodeAudioSource {
  url: string | null
  reason?: 'PRIVATE_MEDIA_UNAVAILABLE' | 'NO_MEDIA' | 'FETCH_FAILED'
}

