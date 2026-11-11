import alova from '@/alova'
import { unwrapPage } from '@/api/normalize'
import type { ImageUrls, PageResult } from '@/api/types'

/**
 * 互动通知接口契约（真实抓包 + APK 静态分析双重确认，2026-11-11）：
 *
 *   POST /notice_list   body: { loadMoreKey? }
 *   resp: { data: NoticeInfo[] }            // 本账号 7 条；没有更多时可能不带 loadMoreKey
 *
 * `NoticeInfo` 字段就是下面 Notice 的字段（真实响应顶层只有这些）：
 *   id / uid / action / createdAt / source / target / blockable / blocked
 * - `uid` 是**收件人（我）**的 uid，不是触发者 uid；
 * - `action`：`"LIKE"` = 点赞、`"COMMENT"` = 回复（关注推断为 `"FOLLOW"`，未在本账号抓到）；
 * - `LIKE`：`target` 是被赞的评论（Comment，`author` 是我），
 *   `source` 是 `{type:"USER_LIST", users:[UserBasic], count}`，触发者取 `users[0]`；
 * - `COMMENT`：`target` 是我的原评论，`source` 是对方回复的 Comment，
 *   触发者取 `source.author`，回复正文取 `source.text`；
 * - `target.owner` 是 `{id:<单集 eid>, type:"EPISODE"}`，`target.pid` 是节目 id；
 * - `blockable` 点赞为 true、回复为 false（以真实字段为准）。
 *
 * 下面仍保留「未知结构也不崩」的容错提取：上游以后换形状时页面只降级，不白屏。
 */

/** 四类通知：点赞 / 回复 / 关注 / 未知（未知仍要能渲染一行，只是文案与图标兜底） */
export type NoticeKind = 'like' | 'reply' | 'follow' | 'unknown'

/** 分页游标：上游结构未知，可能是字符串或对象，原样回传 */
export type NoticeLoadMoreKey = string | Record<string, unknown>

export interface Notice {
  id: string
  uid: string
  action: string
  /** TypeData（多态，未知结构） */
  source?: unknown
  /** TypeData（多态，未知结构） */
  target?: unknown
  createdAt: string
  blockable?: boolean
  blocked?: boolean
}

export interface NoticeListParams {
  loadMoreKey?: NoticeLoadMoreKey
}

export type NoticePageResult = PageResult<Notice, NoticeLoadMoreKey>

function readString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

/**
 * 把上游任意条目归一化成 `Notice`。
 * 只保证静态合同里的字段可读；缺字段用安全的默认值补位，多出来的字段不保留
 * （要展示的内容都从 source/target 里安全提取，见下方 helper）。
 */
function toNotice(raw: unknown, index: number): Notice | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>

  const notice: Notice = {
    id: readString(record.id) ?? readString(record.noticeId) ?? `notice-${index}`,
    uid: readString(record.uid) ?? readString(record.userId) ?? '',
    action: readString(record.action) ?? readString(record.type) ?? '',
    source: record.source,
    target: record.target,
    createdAt:
      readString(record.createdAt) ??
      readString(record.createTime) ??
      readString(record.publishTime) ??
      '',
  }
  if (typeof record.blockable === 'boolean') notice.blockable = record.blockable
  if (typeof record.blocked === 'boolean') notice.blocked = record.blocked
  return notice
}

/**
 * 互动通知列表（分页）。
 * 返回干净的 `{ items, loadMoreKey? }`，页面不需要再解包裹/判空。
 */
export const noticeListAPI = (params?: NoticeListParams) =>
  alova.Post<unknown>('/notice_list', params ?? {}).then((raw): NoticePageResult => {
    const page = unwrapPage<unknown, NoticeLoadMoreKey>(raw)
    const items = page.items
      .map((item, index) => toNotice(item, index))
      .filter((notice): notice is Notice => notice !== null)
    return {
      items,
      ...(page.loadMoreKey !== undefined ? { loadMoreKey: page.loadMoreKey } : {}),
    }
  })

// 收件箱已读/移除接口在 `src/api/inbox.ts` 的 `inboxRemoveAPI`（v2 收件箱配套）。

// ---------------------------------------------------------------------------
// source / target 的安全提取
//
// TypeData 是多态的，抓包之前不假设任何固定结构：
// 在对象 / 数组 / 看似 JSON 的字符串里做有深度上限的递归查找，
// 按「顶层字段 → 子节点」的顺序取第一个命中的值。任何异常都吞掉、返回 undefined。
// ---------------------------------------------------------------------------

const MAX_WALK_DEPTH = 8

const EID_KEYS = ['eid', 'episodeEid', 'episodeId', 'episode_id'] as const
const COMMENT_ID_KEYS = ['commentId', 'comment_id'] as const
const NICKNAME_KEYS = ['nickname', 'nickName', 'displayName', 'userName'] as const
const AVATAR_KEYS = ['avatar', 'avatarUrl', 'avatarPicture', 'profilePicture', 'userAvatar'] as const
const EPISODE_TITLE_KEYS = ['episodeTitle'] as const

const EPISODE_TYPE_NAMES = new Set(['EPISODE', 'EPISODES', 'PODCAST_EPISODE', 'SINGLE_EPISODE'])
const COMMENT_TYPE_NAMES = new Set(['COMMENT', 'COMMENTS', 'COMMENT_REPLY', 'REPLY'])

const IMAGE_URL_KEYS = ['picUrl', 'largePicUrl', 'middlePicUrl', 'smallPicUrl', 'thumbnailUrl'] as const

const LIKE_ACTION_WORDS = ['LIKE', 'CLAP', 'REACTION', 'THUMB'] as const
const REPLY_ACTION_WORDS = ['REPLY', 'COMMENT'] as const
const FOLLOW_ACTION_WORDS = ['FOLLOW', 'SUBSCRIBE'] as const

/** action → 四类通知。真实枚举先精确匹配，认不出再退回关键字包含，最后 unknown。 */
export function getNoticeKind(action: string): NoticeKind {
  const normalized = (action || '').trim().toUpperCase()
  if (normalized === 'LIKE') return 'like'
  if (normalized === 'COMMENT' || normalized === 'REPLY') return 'reply'
  if (normalized === 'FOLLOW') return 'follow'
  if (REPLY_ACTION_WORDS.some((word) => normalized.includes(word))) return 'reply'
  if (LIKE_ACTION_WORDS.some((word) => normalized.includes(word))) return 'like'
  if (FOLLOW_ACTION_WORDS.some((word) => normalized.includes(word))) return 'follow'
  return 'unknown'
}

const ACTION_TEXT: Record<NoticeKind, string> = {
  like: '赞了你',
  reply: '回复了你',
  follow: '关注了你',
  unknown: '和你互动了',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isUrlLike(value: string): boolean {
  return /^(https?:)?\/\//i.test(value) || value.startsWith('/')
}

function isImageUrlsLike(value: Record<string, unknown>): boolean {
  return IMAGE_URL_KEYS.some((key) => typeof value[key] === 'string' && value[key] !== '')
}

/** 把各种头像写法（ImageUrls / URL 字符串 / `{picture: ImageUrls}`）收敛成 SmartImage 能吃的值 */
function asImage(value: unknown, depth = 0): ImageUrls | string | null {
  if (depth > 3) return null
  if (typeof value === 'string') return isUrlLike(value) ? value : null
  if (!isRecord(value)) return null
  if (isImageUrlsLike(value)) return value as unknown as ImageUrls
  for (const key of ['picture', 'avatar', 'image']) {
    const nested = asImage(value[key], depth + 1)
    if (nested) return nested
  }
  return null
}

/**
 * 在任意多态结构里递归查找：字符串会被当作可能是序列化后的 JSON 再试一次。
 * `visit` 返回非空值即命中；只要不抛异常，未知结构最差也只是返回 undefined。
 */
function walkDeep(
  input: unknown,
  visit: (record: Record<string, unknown>) => unknown,
  depth = 0,
): unknown {
  if (depth > MAX_WALK_DEPTH || input === null || input === undefined) return undefined

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
    try {
      return walkDeep(JSON.parse(trimmed), visit, depth + 1)
    } catch {
      return undefined
    }
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const found = walkDeep(item, visit, depth + 1)
      if (found !== undefined) return found
    }
    return undefined
  }

  if (!isRecord(input)) return undefined

  const direct = visit(input)
  if (direct !== undefined && direct !== null && direct !== '') return direct

  for (const value of Object.values(input)) {
    const found = walkDeep(value, visit, depth + 1)
    if (found !== undefined) return found
  }
  return undefined
}

function findStringDeep(input: unknown, keys: readonly string[]): string | undefined {
  const value = walkDeep(input, (record) => {
    for (const key of keys) {
      const candidate = record[key]
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
      if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate)
    }
    return undefined
  })
  return typeof value === 'string' ? value : undefined
}

function findValueDeep(input: unknown, keys: readonly string[]): unknown {
  return walkDeep(input, (record) => {
    for (const key of keys) {
      const candidate = record[key]
      if (candidate !== undefined && candidate !== null && candidate !== '') return candidate
    }
    return undefined
  })
}

/** 找形如 `{ type: 'EPISODE', id }` 的实体并取它的 id（评论的 owner 就是这种写法） */
function findTypedIdDeep(input: unknown, typeNames: ReadonlySet<string>): string | undefined {
  const value = walkDeep(input, (record) => {
    const type = typeof record.type === 'string' ? record.type.trim().toUpperCase() : ''
    if (!typeNames.has(type)) return undefined
    for (const key of ['eid', 'id', 'episodeEid', 'episodeId']) {
      const candidate = record[key]
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    }
    return undefined
  })
  return typeof value === 'string' ? value : undefined
}

/**
 * 找单集标题：只认「长得像单集」的记录（type 是 EPISODE，或带 eid），
 * 避免把播客标题、账号认证里的节目名（如「夜晚的潜水艇」）误当成内容摘要。
 */
function findEpisodeTitleDeep(input: unknown): string | undefined {
  const value = walkDeep(input, (record) => {
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    if (!title) return undefined
    const type = typeof record.type === 'string' ? record.type.trim().toUpperCase() : ''
    if (EPISODE_TYPE_NAMES.has(type)) return title
    if (typeof record.eid === 'string' && record.eid) return title
    return undefined
  })
  return typeof value === 'string' ? value : undefined
}

export interface NoticeActor {
  nickname: string
  avatar: ImageUrls | string | null
}

function readActorFromUser(value: unknown): NoticeActor | null {
  if (!isRecord(value)) return null
  const nickname = readString(value.nickname) ?? ''
  const avatar = asImage(value.avatar)
  if (!nickname && !avatar) return null
  return { nickname: nickname || '一位听友', avatar }
}

/**
 * 谁触发了这条通知。真实结构：
 * - LIKE：`source.users[0]`（UserBasic）
 * - COMMENT：`source.author`（UserBasic）
 * 拿不到再退回递归查找；都没有时显示「一位听友」（不露裸 uid）。
 */
export function extractNoticeActor(notice: Notice): NoticeActor {
  const source = isRecord(notice.source) ? notice.source : undefined
  if (source) {
    if (Array.isArray(source.users)) {
      for (const user of source.users) {
        const actor = readActorFromUser(user)
        if (actor) return actor
      }
    }
    const fromAuthor = readActorFromUser(source.author)
    if (fromAuthor) return fromAuthor
  }

  const target = isRecord(notice.target) ? notice.target : undefined
  const fromTargetAuthor = readActorFromUser(target?.author)
  if (fromTargetAuthor) return fromTargetAuthor

  const nickname =
    findStringDeep(notice.source, NICKNAME_KEYS) ??
    findStringDeep(notice.target, NICKNAME_KEYS) ??
    findStringDeep(notice, NICKNAME_KEYS) ??
    ''
  const avatarValue =
    findValueDeep(notice.source, AVATAR_KEYS) ??
    findValueDeep(notice.target, AVATAR_KEYS) ??
    findValueDeep(notice.source, ['picture']) ??
    findValueDeep(notice.target, ['picture'])

  return {
    nickname: nickname || '一位听友',
    avatar: asImage(avatarValue),
  }
}

/** 从真实结构里挖被互动单集的 eid：优先 `target.owner = {id, type:"EPISODE"}` */
export function extractNoticeEpisodeEid(notice: Notice): string | undefined {
  const target = isRecord(notice.target) ? notice.target : undefined
  const owner = isRecord(target?.owner) ? target.owner : undefined
  if (owner) {
    const type = typeof owner.type === 'string' ? owner.type.trim().toUpperCase() : ''
    const id = readString(owner.id)
    if (id && (type === 'EPISODE' || type === '')) return id
  }

  const direct =
    findStringDeep(notice.target, EID_KEYS) ?? findStringDeep(notice.source, EID_KEYS)
  if (direct) return direct

  // 评论的 owner 是 `{ type:'EPISODE', id }`，没有 eid 字段，用类型提示兜底
  return (
    findTypedIdDeep(notice.target, EPISODE_TYPE_NAMES) ??
    findTypedIdDeep(notice.source, EPISODE_TYPE_NAMES)
  )
}

/**
 * 通知关联的评论 id：
 * - 回复：`source.id` 是对方回复的评论（深链应锚到这条），兜底 `target.id`（我的原评论）
 * - 点赞：`target.id` 是被赞的评论
 * 暂无评论详情路由，先保留给后续深链用。
 */
export function extractNoticeCommentId(notice: Notice): string | undefined {
  const kind = getNoticeKind(notice.action)
  const source = isRecord(notice.source) ? notice.source : undefined
  const target = isRecord(notice.target) ? notice.target : undefined

  if (kind === 'reply') return readString(source?.id) ?? readString(target?.id)
  if (kind === 'like') return readString(target?.id) ?? readString(source?.id)

  const direct =
    findStringDeep(notice.source, COMMENT_ID_KEYS) ??
    findStringDeep(notice.target, COMMENT_ID_KEYS)
  if (direct) return direct

  return (
    findTypedIdDeep(notice.source, COMMENT_TYPE_NAMES) ??
    findTypedIdDeep(notice.target, COMMENT_TYPE_NAMES)
  )
}

/**
 * 一行里能展示的摘要（真实结构）：
 * - 回复：`source.text` 是对方回复的正文；
 * - 点赞：`source` 是 USER_LIST（没有正文），展示被赞的我的评论 `target.text`；
 * - 其他：尽量找评论正文，再退单集标题；都没有就留空（不占位）。
 */
export function extractNoticeSummary(notice: Notice): string {
  const kind = getNoticeKind(notice.action)
  const source = isRecord(notice.source) ? notice.source : undefined
  const target = isRecord(notice.target) ? notice.target : undefined
  const sourceText = readString(source?.text)
  const targetText = readString(target?.text)

  if (kind === 'reply' && (sourceText || targetText)) return sourceText ?? targetText ?? ''
  if (kind === 'like' && (targetText || sourceText)) return targetText ?? sourceText ?? ''
  if (sourceText || targetText) return sourceText ?? targetText ?? ''

  const explicitTitle =
    findStringDeep(notice.source, EPISODE_TITLE_KEYS) ??
    findStringDeep(notice.target, EPISODE_TITLE_KEYS)
  if (explicitTitle) return explicitTitle

  return findEpisodeTitleDeep(notice.source) ?? findEpisodeTitleDeep(notice.target) ?? ''
}

/** 页面渲染用的一行视图数据：容器结构怎么变，页面只消费这个稳定形状。 */
export interface NoticeView {
  kind: NoticeKind
  actorName: string
  actorAvatar: ImageUrls | string | null
  actionText: string
  summary: string
  /** 可跳转的单集 id；undefined 表示该行不可点 */
  eid?: string
}

/** 把一条 `Notice` 收敛成渲染所需的视图数据（所有未知结构在这里被消化）。 */
export function describeNotice(notice: Notice): NoticeView {
  const kind = getNoticeKind(notice.action)
  const actor = extractNoticeActor(notice)
  const eid = extractNoticeEpisodeEid(notice)

  return {
    kind,
    actorName: actor.nickname,
    actorAvatar: actor.avatar,
    actionText: ACTION_TEXT[kind],
    summary: extractNoticeSummary(notice),
    ...(eid ? { eid } : {}),
  }
}
