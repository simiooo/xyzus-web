import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { editorPickListHistoryAPI } from '@/api/discovery'
import PageHeader from '@/components/ui/PageHeader'
import SectionHead from '@/components/ui/SectionHead'
import EpisodeRow from '@/components/rows/EpisodeRow'
import EmptyState from '@/components/ui/EmptyState'
import { EpisodeRowsSkeleton, SkeletonBox } from '@/components/ui/Skeleton'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { formatDate } from '@/utils/format'
import type { EditorPick, EditorPickGroup } from '@/api/types'

/** 编辑评语在数据里可能是 Comment 对象，也可能是纯字符串，统一取文字 */
function commentText(comment: EditorPick['comment'] | unknown): string {
  if (typeof comment === 'string') return comment.trim()
  if (comment && typeof comment === 'object') {
    const text = (comment as Record<string, unknown>).text
    if (typeof text === 'string') return text.trim()
  }
  return ''
}

/** 丢掉没有单集数据的坏条目，页面只负责渲染有效精选 */
function validPicks(group: EditorPickGroup): EditorPick[] {
  if (!Array.isArray(group.picks)) return []
  return group.picks.filter((pick) => Boolean(pick?.episode?.eid && pick.episode.title))
}

function LoadError({ hint, onRetry }: { hint: string; onRetry: () => void }) {
  return (
    <div className="py-12">
      <p className="m-0 type-title text-[var(--ink)]">没能加载出来</p>
      <p className="m-0 mt-2 max-w-[420px] type-sub">{hint}</p>
      <button type="button" onClick={onRetry} className="pill pill-ink mt-5">
        重试
      </button>
    </div>
  )
}

export default function EditorPicks() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<EditorPickGroup[]>([])
  const [loadMoreKey, setLoadMoreKey] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    editorPickListHistoryAPI()
      .then((page) => {
        if (cancelled) return
        setGroups(Array.isArray(page.items) ? page.items : [])
        setLoadMoreKey(page.loadMoreKey)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setGroups([])
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const retry = () => {
    setError(false)
    setLoading(true)
    setReloadToken((token) => token + 1)
  }

  const loadMore = () => {
    if (!loadMoreKey || loadingMore) return
    setLoadingMore(true)
    setLoadMoreError(false)
    editorPickListHistoryAPI({ loadMoreKey })
      .then((page) => {
        setGroups((prev) => [...prev, ...(Array.isArray(page.items) ? page.items : [])])
        setLoadMoreKey(page.loadMoreKey)
      })
      .catch(() => setLoadMoreError(true))
      .finally(() => setLoadingMore(false))
  }

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: Boolean(loadMoreKey) && !loadingMore && !loadMoreError,
  })

  const hasGroups = groups.some((group) => validPicks(group).length > 0)

  return (
    <div>
      <PageHeader
        title="编辑精选"
        description="编辑部每天挑出值得听的单集，并写下推荐理由。"
        size="display"
      />

      {loading ? (
        <div className="space-y-9">
          {[0, 1].map((index) => (
            <div key={index}>
              <SkeletonBox className="h-[14px] w-[120px]" rounded="sm" />
              <div className="mt-4">
                <EpisodeRowsSkeleton count={3} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <LoadError hint="精选列表没能取回来，可能是网络或服务暂时不可用。" onRetry={retry} />
      ) : !hasGroups ? (
        <EmptyState
          title="还没有编辑精选"
          hint="编辑们还在挑，过几天再来看看。"
          action={
            <button type="button" className="pill pill-ink" onClick={() => navigate('/')}>
              去发现页
            </button>
          }
        />
      ) : (
        <>
          <div className="space-y-10">
            {groups.map((group, groupIndex) => {
              const picks = validPicks(group)
              return (
                <section key={`${group.date}-${groupIndex}`}>
                  <SectionHead
                    level="section"
                    title={formatDate(group.date, { short: true }) || '编辑精选'}
                    aside={picks.length > 0 ? `${picks.length} 个单集` : undefined}
                    className="mb-2"
                  />

                  {picks.length === 0 ? (
                    <p className="m-0 py-3 type-sub">这一组暂时没有精选单集。</p>
                  ) : (
                    <div className="row-grid">
                      {picks.map((pick, index) => {
                        const note = commentText(pick.comment)
                        return (
                          <div key={pick.episode.eid} className={index > 0 ? 'dotted-top' : undefined}>
                            <EpisodeRow episode={pick.episode} showExcerpt />
                            {/* 编辑推荐语对齐单集行的文字列：封面 64 + 行 gap 16 = 80 */}
                            {note && (
                              <p className="m-0 mt-0.5 line-clamp-1 pl-20 type-sub">
                                编辑推荐：{note}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          {loadingMore && (
            <div className="mt-8">
              <EpisodeRowsSkeleton count={2} />
            </div>
          )}

          {loadMoreError ? (
            <div className="dotted-top mt-2 py-8">
              <p className="m-0 type-sub">更早的精选没能加载出来。</p>
              <button type="button" onClick={loadMore} className="pill pill-ink mt-4">
                重试
              </button>
            </div>
          ) : (
            loadMoreKey && <div ref={sentinelRef} className="h-1" aria-hidden />
          )}
        </>
      )}
    </div>
  )
}
