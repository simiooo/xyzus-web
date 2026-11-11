import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { MessageSquare } from 'lucide-react'
import { myCommentListAPI, type MyComment, type MyCommentOrder } from '@/api/comment'
import { formatCommentTime, formatCount } from '@/utils/format'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import SmartImage from '@/components/ui/SmartImage'
import { EpisodeRowsSkeleton } from '@/components/ui/Skeleton'

const TABS: { key: MyCommentOrder; label: string }[] = [
  { key: 'TIME', label: '最新' },
  { key: 'LIKE', label: '最热' },
]

/**
 * 我的评论（/comment_list_mine）：只读列表，按最新 / 最热两种排序。
 * 每条展示评论摘要 + 所在单集（真实接口会带 episode），点整行进单集页。
 */
export default function MyComments() {
  const navigate = useNavigate()
  const [order, setOrder] = useState<MyCommentOrder>('TIME')
  const [comments, setComments] = useState<MyComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      setLoading(true)
      setError(false)
      myCommentListAPI({ order })
        .then((list) => {
          if (cancelled) return
          setComments(list)
          setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setComments([])
          setError(true)
          setLoading(false)
        })
    }
    // 不在 effect 体内同步 setState（react-hooks/set-state-in-effect）：推一个微任务再开始加载
    void Promise.resolve().then(load)
    return () => {
      cancelled = true
    }
  }, [order, reloadToken])

  return (
    <div>
      <PageHeader
        title="我的评论"
        aside={loading || error ? undefined : `${comments.length} 条`}
        description="你写过的评论都在这里，点一条回到它所在的单集。"
      />

      <div role="tablist" aria-label="评论排序" className="mb-4 flex items-center gap-7 px-1">
        {TABS.map((item) => {
          const selected = item.key === order
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setOrder(item.key)}
              className="relative cursor-pointer border-0 bg-transparent p-0 pb-2 type-group transition-colors"
              style={{
                color: selected ? 'var(--ink)' : 'var(--muted-foreground)',
                fontWeight: 500,
              }}
            >
              {item.label}
              {selected && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--ink)]" />}
            </button>
          )
        })}
      </div>

      {loading ? (
        <EpisodeRowsSkeleton count={5} />
      ) : error ? (
        <div className="py-10">
          <p className="m-0 type-title text-[var(--ink)]">没能加载出来</p>
          <p className="m-0 mt-1.5 max-w-[420px] type-sub">我的评论没能取回来，可能是网络或服务暂时不可用。</p>
          <button type="button" onClick={() => setReloadToken((token) => token + 1)} className="pill pill-ink mt-4">
            重试
          </button>
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          title="还没有发过评论"
          hint="在单集页写下第一条想法吧。"
          action={
            <button type="button" className="pill pill-ink" onClick={() => navigate('/')}>
              <MessageSquare size={16} strokeWidth={1.75} />
              去发现
            </button>
          }
        />
      ) : (
        <div>
          {comments.map((comment, index) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              divided={index > 0}
              onOpen={(eid) => navigate(`/episode/${eid}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CommentRow({
  comment,
  divided,
  onOpen,
}: {
  comment: MyComment
  divided: boolean
  onOpen: (eid: string) => void
}) {
  const episode = comment.episode
  const eid = episode?.eid ?? (comment.owner?.type === 'EPISODE' ? comment.owner.id : '')
  const cover = episode?.image ?? episode?.podcast?.image
  const episodeTitle = episode?.title
  const podcastTitle = episode?.podcast?.title

  const content = (
    <div className="row row-pressable w-full">
      {cover && (
        <SmartImage
          image={cover}
          aspectRatio={1}
          rounded="md"
          className="h-[52px] w-[52px] flex-shrink-0"
          alt={episodeTitle || '单集封面'}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="m-0 line-clamp-2 type-manage text-[var(--ink)]">{comment.text}</p>
        <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 type-meta">
          {episodeTitle && <span className="max-w-[360px] truncate">{episodeTitle}</span>}
          {podcastTitle && (
            <>
              <span>·</span>
              <span className="max-w-[160px] truncate">{podcastTitle}</span>
            </>
          )}
          <span>·</span>
          <span>{formatCommentTime(comment.createdAt)}</span>
          {comment.likeCount > 0 && (
            <>
              <span>·</span>
              <span>{formatCount(comment.likeCount)} 赞</span>
            </>
          )}
        </p>
      </div>
    </div>
  )

  return (
    <div className={divided ? 'dotted-top' : undefined}>
      {eid ? (
        <button type="button" onClick={() => onOpen(eid)} className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left">
          {content}
        </button>
      ) : (
        content
      )}
    </div>
  )
}
