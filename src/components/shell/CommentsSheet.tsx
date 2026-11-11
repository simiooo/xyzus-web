import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { App as AntdApp } from 'antd'
import { MessageCircle, X } from 'lucide-react'
import { commentCreateAPI, commentPrimaryAPI } from '@/api/comment'
import useAudioStore from '@/stores/audioStore'
import useAuthStore from '@/stores/authStore'
import useUiStore from '@/stores/uiStore'
import CommentItem from '@/components/comments/CommentItem'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { formatCount } from '@/utils/format'
import type { Comment, CommentPrimaryLoadMoreKey } from '@/api/types'

/** 把接口错误翻成一句能读的中文（接口层承诺其 message 是中文） */
function readableError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message.trim() : ''
  if (!raw) return fallback
  if (raw.length > 60) return fallback
  if (!/[\u4e00-\u9fa5]/.test(raw)) return fallback
  return raw
}

/**
 * 播放条右侧的评论浮层：不离开当前页面就能看、能互动。
 * 完整交互：发布评论、点赞、收藏、回复、展开回复、删除自己的评论；
 * 数据与单集页评论区共用同一套接口与组件。
 */
export default function CommentsSheet() {
  const { message } = AntdApp.useApp()
  const open = useUiStore((s) => s.commentsOpen)
  const setOpen = useUiStore((s) => s.setCommentsOpen)
  const episode = useAudioStore((s) => s.currentEpisode)
  const currentUserId = useAuthStore((s) => s.user?.uid)
  const currentUser = useAuthStore((s) => s.user)

  const [comments, setComments] = useState<Comment[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loadMoreKey, setLoadMoreKey] = useState<CommentPrimaryLoadMoreKey | undefined>()
  const [loadingMore, setLoadingMore] = useState(false)

  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const postLockRef = useRef(false)

  const genRef = useRef(0)
  const eid = episode?.eid

  const fetchFirst = useCallback(
    (id: string) => {
      const gen = ++genRef.current
      setLoading(true)
      setFailed(false)
      setLoadMoreKey(undefined)
      commentPrimaryAPI({ id, order: 'HOT' })
        .then((page) => {
          if (gen !== genRef.current) return
          setComments(page.items ?? [])
          setLoadMoreKey(page.loadMoreKey)
        })
        .catch(() => {
          if (gen === genRef.current) setFailed(true)
        })
        .finally(() => {
          if (gen === genRef.current) setLoading(false)
        })
    },
    [],
  )

  useEffect(() => {
    if (!open || !eid) return
    const count = episode?.commentCount ?? 0
    // 不在 effect 体内同步 setState（react-hooks/set-state-in-effect）：推一个微任务再开始加载
    void Promise.resolve().then(() => {
      setTotalCount(count)
      fetchFirst(eid)
    })
  }, [open, eid, episode?.commentCount, fetchFirst])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const loadMore = () => {
    if (!eid || !loadMoreKey || loadingMore) return
    const gen = genRef.current
    setLoadingMore(true)
    commentPrimaryAPI({ id: eid, order: 'HOT', loadMoreKey })
      .then((page) => {
        if (gen !== genRef.current) return
        setComments((prev) => [...prev, ...(page.items ?? [])])
        setLoadMoreKey(page.loadMoreKey)
      })
      .catch(() => {
        /* 失败就停在当前列表 */
      })
      .finally(() => {
        if (gen === genRef.current) setLoadingMore(false)
      })
  }

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: open && Boolean(loadMoreKey) && !loadingMore,
  })

  const patchComment = (commentId: string, patch: Partial<Comment>) => {
    setComments((prev) => prev.map((item) => (item.id === commentId ? { ...item, ...patch } : item)))
  }

  const removeComment = (commentId: string) => {
    setComments((prev) => prev.filter((item) => item.id !== commentId))
    setTotalCount((prev) => Math.max(0, prev - 1))
  }

  const submitComment = async () => {
    const text = draft.trim()
    if (!text || !eid || postLockRef.current) return
    postLockRef.current = true
    setPosting(true)
    try {
      await commentCreateAPI({ id: eid, type: 'EPISODE', text })
      message.success('评论已发布')
      setDraft('')
      setTotalCount((prev) => prev + 1)
      fetchFirst(eid)
    } catch (error) {
      message.error(readableError(error, '评论发布失败，内容已保留，请重试'))
    } finally {
      postLockRef.current = false
      setPosting(false)
    }
  }

  if (!open || !episode) return null

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-[rgba(20,20,20,0.10)]"
        aria-label="关闭评论"
        onClick={() => setOpen(false)}
      />

      <div className="absolute bottom-[calc(var(--tabbar-h)+var(--player-h)+10px)] left-3 right-3 flex max-h-[min(72vh,640px)] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-sheet lg:bottom-[calc(var(--player-h)+16px)] lg:left-auto lg:right-6 lg:w-[420px]">
        {/* 头 */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="type-title text-[var(--ink)]">评论</span>
            <span className="type-meta">{formatCount(totalCount)} 条</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭评论"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[var(--faint)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)]"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* 发评论 + 列表 */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-thin px-4 py-3">
          <div className="flex items-start gap-3">
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--muted-strong)] text-[14px] font-semibold text-[var(--muted-foreground)]"
              aria-hidden
            >
              {(currentUser?.nickname || '我').slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1 rounded-[18px] bg-[var(--muted)] px-3.5 py-2.5 transition-shadow focus-within:shadow-[inset_0_0_0_1px_var(--accent)]">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    void submitComment()
                  }
                }}
                rows={2}
                disabled={posting}
                placeholder="说点什么…"
                aria-label="写评论"
                className="w-full resize-none border-0 bg-transparent text-[15px] leading-[1.6] text-[var(--ink)] outline-none placeholder:text-[var(--faint)] disabled:opacity-60"
              />
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <span className="type-meta">{posting ? '发布中…' : '⌘/Ctrl + Enter 发布'}</span>
                <button
                  type="button"
                  className="pill pill-ink"
                  disabled={!draft.trim() || posting}
                  onClick={() => void submitComment()}
                >
                  {posting ? '发布中…' : '发布'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-1">
            {loading ? (
              <div className="space-y-4 py-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex gap-3">
                    <span className="h-8 w-8 flex-shrink-0 rounded-full bg-[var(--muted)]" />
                    <span className="mt-1 h-12 flex-1 rounded-md bg-[var(--muted)]" />
                  </div>
                ))}
              </div>
            ) : failed ? (
              <div className="py-10 text-center">
                <p className="m-0 type-sub">评论加载失败，稍后再试。</p>
                <button
                  type="button"
                  className="pill mt-3"
                  onClick={() => eid && fetchFirst(eid)}
                >
                  重试
                </button>
              </div>
            ) : comments.length === 0 ? (
              <p className="m-0 flex flex-col items-center gap-1 py-10 text-center type-sub">
                <MessageCircle size={22} strokeWidth={1.5} className="text-[var(--faint)]" />
                这集还没有评论，来写第一条。
              </p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    episodeId={episode.eid}
                    currentUserId={currentUserId}
                    compact
                    onPatch={patchComment}
                    onDeleted={removeComment}
                  />
                ))}
                {loadingMore && <p className="m-0 py-3 text-center type-meta">加载中…</p>}
                {loadMoreKey && !loadingMore && <div ref={sentinelRef} className="h-1" aria-hidden />}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
