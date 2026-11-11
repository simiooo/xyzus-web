import { useEffect, useRef, useState } from 'react'
import { App as AntdApp } from 'antd'
import { MessageCircle, Star, ThumbsUp, Trash2 } from 'lucide-react'
import {
  commentCollectCreateAPI,
  commentCollectRemoveAPI,
  commentCreateAPI,
  commentLikeUpdateAPI,
  commentRemoveAPI,
  commentThreadAPI,
} from '@/api/comment'
import SmartImage from '@/components/ui/SmartImage'
import { formatCommentTime, formatCount } from '@/utils/format'
import type { Comment } from '@/api/types'

/** 把接口错误翻成一句能读的中文（接口层承诺其 message 是中文） */
function readableError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message.trim() : ''
  if (!raw) return fallback
  if (raw.length > 60) return fallback
  if (!/[\u4e00-\u9fa5]/.test(raw)) return fallback
  return raw
}

interface CommentItemProps {
  comment: Comment
  /** 评论所属单集，发布回复时传它（后端会映射成 owner:{id,type:'EPISODE'}） */
  episodeId: string
  currentUserId?: string
  depth?: number
  /** 紧凑模式：小浮层里用，头像和正文小一号 */
  compact?: boolean
  onPatch: (commentId: string, patch: Partial<Comment>) => void
  onDeleted: (commentId: string) => void
}

/**
 * 一条评论：圆形头像 + 昵称/属地/时间 + 正文 + 点赞/回复/收藏/删除。
 * 完整交互：点赞、收藏、回复（失焦自动发布）、展开回复、删除自己的评论。
 * 所有失败都不清空、不冻结：状态回滚、恢复可编辑、只给一句中文提示。
 */
export default function CommentItem({
  comment,
  episodeId,
  currentUserId,
  depth = 0,
  compact = false,
  onPatch,
  onDeleted,
}: CommentItemProps) {
  const { message, modal } = AntdApp.useApp()

  const [likeBusy, setLikeBusy] = useState(false)
  const [collectBusy, setCollectBusy] = useState(false)

  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const replyLockRef = useRef(false)
  const replyInputRef = useRef<HTMLInputElement>(null)

  const [replies, setReplies] = useState<Comment[]>([])
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [repliesLoading, setRepliesLoading] = useState(false)
  const [repliesError, setRepliesError] = useState(false)

  const isOwn = Boolean(currentUserId && comment.author?.uid === currentUserId)
  const replyCount = comment.threadReplyCount ?? replies.length

  useEffect(() => {
    if (replyOpen) replyInputRef.current?.focus()
  }, [replyOpen])

  const handleLike = async () => {
    if (likeBusy) return
    setLikeBusy(true)
    const nextLiked = !comment.liked
    const nextCount = Math.max(0, comment.likeCount + (nextLiked ? 1 : -1))
    onPatch(comment.id, { liked: nextLiked, likeCount: nextCount })
    try {
      await commentLikeUpdateAPI({ id: comment.id, liked: nextLiked, type: 'COMMENT' })
    } catch {
      onPatch(comment.id, { liked: comment.liked, likeCount: comment.likeCount })
      message.error('点赞失败，请稍后重试')
    } finally {
      setLikeBusy(false)
    }
  }

  const handleCollect = async () => {
    if (collectBusy) return
    setCollectBusy(true)
    const nextCollected = !comment.collected
    onPatch(comment.id, { collected: nextCollected })
    try {
      if (nextCollected) {
        await commentCollectCreateAPI({ commentId: comment.id })
      } else {
        await commentCollectRemoveAPI({ commentId: comment.id })
      }
    } catch {
      onPatch(comment.id, { collected: comment.collected })
      message.error('收藏评论失败，请稍后重试')
    } finally {
      setCollectBusy(false)
    }
  }

  const handleDelete = () => {
    modal.confirm({
      title: '删除这条评论？',
      content: '删除后无法恢复。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await commentRemoveAPI({ commentId: comment.id })
          message.success('已删除')
          onDeleted(comment.id)
        } catch {
          message.error('删除失败，请稍后重试')
        }
      },
    })
  }

  async function loadReplies(force = false) {
    if (repliesLoading) return
    if (!force && repliesOpen) {
      setRepliesOpen(false)
      return
    }
    setRepliesLoading(true)
    setRepliesError(false)
    try {
      const res = await commentThreadAPI({ primaryCommentId: comment.id, order: 'SMART' })
      setReplies(res.items || [])
      setRepliesOpen(true)
    } catch {
      setRepliesError(true)
    } finally {
      setRepliesLoading(false)
    }
  }

  /** 回复同样失焦发布：失败保留文字、恢复可编辑 */
  const submitReply = async () => {
    const text = replyText.trim()
    if (!text || !episodeId || replyLockRef.current) return
    replyLockRef.current = true
    setReplying(true)
    try {
      await commentCreateAPI({
        id: episodeId,
        type: 'EPISODE',
        text,
        replyToCommentId: comment.id,
      })
      message.success('回复已发布')
      setReplyText('')
      onPatch(comment.id, { threadReplyCount: replyCount + 1 })
      if (repliesOpen) void loadReplies(true)
    } catch (err) {
      message.error(readableError(err, '回复失败，内容已保留，请重试'))
    } finally {
      replyLockRef.current = false
      setReplying(false)
    }
  }

  const avatarClass = depth > 0 ? 'h-8 w-8' : compact ? 'h-8 w-8' : 'h-10 w-10'
  const bodyClass = compact ? 'text-[15px] leading-[1.6]' : 'text-[16px] leading-[1.65]'
  const iconSize = compact ? 16 : 17
  const rowClass = compact ? 'py-2.5' : 'py-4'

  return (
    <div className={rowClass}>
      <div className="flex items-start gap-3">
        <SmartImage
          image={comment.author?.avatar?.picture}
          aspectRatio={1}
          rounded="full"
          className={`${avatarClass} flex-shrink-0`}
          alt={comment.author?.nickname}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {comment.pinned && (
              <span className="type-caps" style={{ color: 'var(--ink)' }}>
                置顶
              </span>
            )}
            <span className="type-row-title text-[var(--ink)]">
              {comment.author?.nickname || '匿名听友'}
            </span>
            {comment.replyToComment?.author?.nickname && (
              <>
                <span aria-hidden>·</span>
                <span className="type-meta">回复 @{comment.replyToComment.author.nickname}</span>
              </>
            )}
            {comment.ipLoc && (
              <>
                <span aria-hidden>·</span>
                <span className="type-meta">{comment.ipLoc}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="type-meta">{formatCommentTime(comment.createdAt)}</span>
          </div>

          <p className={`m-0 mt-1.5 whitespace-pre-wrap text-[var(--ink)] ${bodyClass}`}>
            {comment.text}
          </p>

          <div className="-ml-2 mt-1 flex flex-wrap items-center gap-0.5">
            <CommentAction
              onClick={() => void handleLike()}
              disabled={likeBusy}
              active={comment.liked}
              icon={
                comment.liked ? (
                  <ThumbsUp size={iconSize} strokeWidth={1.75} fill="currentColor" />
                ) : (
                  <ThumbsUp size={iconSize} strokeWidth={1.75} />
                )
              }
              label={comment.liked ? '取消点赞' : '点赞'}
              count={comment.likeCount}
            />

            <CommentAction
              onClick={() => setReplyOpen((value) => !value)}
              active={replyOpen}
              icon={<MessageCircle size={iconSize} strokeWidth={1.75} />}
              label="回复"
              count={comment.threadReplyCount}
            />

            <CommentAction
              onClick={() => void handleCollect()}
              disabled={collectBusy}
              active={comment.collected}
              icon={
                comment.collected ? (
                  <Star size={iconSize} strokeWidth={1.75} fill="currentColor" />
                ) : (
                  <Star size={iconSize} strokeWidth={1.75} />
                )
              }
              label={comment.collected ? '取消收藏' : '收藏评论'}
            />

            {isOwn && (
              <CommentAction
                onClick={handleDelete}
                danger
                icon={<Trash2 size={iconSize} strokeWidth={1.75} />}
                label="删除评论"
              />
            )}
          </div>

          {replyOpen && (
            <div className="mt-2">
              <input
                ref={replyInputRef}
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void submitReply()
                  }
                  if (e.key === 'Escape') {
                    setReplyOpen(false)
                    setReplyText('')
                  }
                }}
                disabled={replying}
                placeholder={`回复 ${comment.author?.nickname || '这条评论'}…`}
                aria-label="回复评论"
                className="h-10 w-full min-w-0 rounded-[20px] border-0 bg-[var(--muted)] px-4 text-[14px] text-[var(--ink)] outline-none transition-shadow placeholder:text-[var(--faint)] focus:shadow-[inset_0_0_0_1px_var(--accent)] disabled:opacity-60"
              />
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="type-meta">
                  {replying ? '发布中…' : 'Enter 发送；失败会保留内容'}
                </span>
                <button
                  type="button"
                  className="pill pill-ink"
                  disabled={!replyText.trim() || replying}
                  onClick={() => void submitReply()}
                >
                  回复
                </button>
              </div>
            </div>
          )}

          {replyCount > 0 && (
            <button
              type="button"
              onClick={() => void loadReplies()}
              className="-ml-2 mt-1 inline-flex h-7 items-center rounded-full border-0 bg-transparent px-2 type-sub transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
            >
              {repliesLoading
                ? '加载回复中…'
                : repliesError
                  ? '回复加载失败，重试'
                  : repliesOpen
                    ? '收起回复'
                    : `查看 ${formatCount(replyCount)} 条回复`}
            </button>
          )}

          {repliesOpen && replies.length > 0 && (
            /* 回复列表不画竖线/点线：靠缩进层级、较小头像与更轻的字号区分 */
            <div className="mt-1.5 flex flex-col">
              {replies.map((reply) => (
                <div key={reply.id}>
                  <CommentItem
                    comment={reply}
                    episodeId={episodeId}
                    currentUserId={currentUserId}
                    depth={depth + 1}
                    compact={compact}
                    onPatch={(commentId, patch) =>
                      setReplies((prev) =>
                        prev.map((item) => (item.id === commentId ? { ...item, ...patch } : item)),
                      )
                    }
                    onDeleted={(commentId) =>
                      setReplies((prev) => prev.filter((item) => item.id !== commentId))
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface CommentActionProps {
  onClick: () => void
  icon: React.ReactNode
  label: string
  count?: number
  active?: boolean
  danger?: boolean
  disabled?: boolean
}

/** 评论行内的小动作：墨色（不是强调色），悬停才有灰底 */
function CommentAction({
  onClick,
  icon,
  label,
  count,
  active = false,
  danger = false,
  disabled = false,
}: CommentActionProps) {
  const colorClass = danger
    ? 'text-[var(--faint)] hover:text-[var(--destructive)]'
    : active
      ? 'text-[var(--ink)]'
      : 'text-[var(--faint)] hover:text-[var(--ink)]'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`inline-flex h-8 items-center gap-1 rounded-full border-0 bg-transparent px-2 transition-colors hover:bg-[var(--muted)] disabled:opacity-50 cursor-pointer ${colorClass}`}
    >
      {icon}
      {typeof count === 'number' && count > 0 && (
        <span className="type-meta tabnum">{formatCount(count)}</span>
      )}
    </button>
  )
}
