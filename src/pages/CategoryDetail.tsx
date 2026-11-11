import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import {
  categoryListAPI,
  categoryListTabAPI,
  categoryPodcastListAPI,
  type CategoryTab,
} from '@/api/category'
import PageHeader from '@/components/ui/PageHeader'
import PodcastTile from '@/components/rows/PodcastTile'
import EmptyState from '@/components/ui/EmptyState'
import { ShelfSkeleton, SkeletonBox } from '@/components/ui/Skeleton'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import type { PodcastBasic } from '@/api/types'

interface CategoryHint {
  name?: string
  emoji?: string
}

const GRID_GAP = 16

/** 节目网格的容器宽度：用来把 PodcastTile 的固定宽度算成响应式 2/3/4 列 */
function useGridWidth() {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = gridRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { gridRef, width }
}

function columnsForWidth(width: number): number {
  if (width >= 1400) return 6
  if (width >= 1100) return 5
  if (width >= 840) return 4
  if (width >= 560) return 3
  return 2
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

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()

  if (!id) {
    return (
      <EmptyState title="没有找到这个分类" hint="从分类列表重新进入一个分类吧。" />
    )
  }

  const hint = (location.state ?? null) as CategoryHint | null
  // 换分类时整体重挂：分页、标签与加载状态全部归零
  return <CategoryDetailBody key={id} categoryId={id} hint={hint} />
}

function CategoryDetailBody({ categoryId, hint }: { categoryId: string; hint: CategoryHint | null }) {
  const navigate = useNavigate()
  const hintName = hint?.name
  const hintEmoji = hint?.emoji

  const [name, setName] = useState(hintName ?? '')
  const [emoji, setEmoji] = useState(hintEmoji ?? '')
  const [tabs, setTabs] = useState<CategoryTab[]>([])
  const [tab, setTab] = useState('')
  const [podcasts, setPodcasts] = useState<PodcastBasic[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadMoreKey, setLoadMoreKey] = useState<number | undefined>()
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const requestRef = useRef(0)
  const { gridRef, width } = useGridWidth()

  const loadFirstPage = useCallback(
    async (targetId: string, tabKey: string, isCancelled?: () => boolean) => {
      const token = requestRef.current + 1
      requestRef.current = token
      try {
        const page = await categoryPodcastListAPI({
          categoryId: targetId,
          tab: tabKey || undefined,
        })
        if (isCancelled?.() || token !== requestRef.current) return
        setPodcasts(
          page.items.map((item) => item.podcast).filter((podcast) => Boolean(podcast?.pid)),
        )
        setLoadMoreKey(page.loadMoreKey)
        setLoadingMore(false)
        setLoadMoreError(false)
        setStatus('ready')
      } catch {
        if (isCancelled?.() || token !== requestRef.current) return
        setPodcasts([])
        setLoadMoreKey(undefined)
        setStatus('error')
      }
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled

    const bootstrap = async () => {
      try {
        const [categoryList, tabList] = await Promise.all([
          hintName ? Promise.resolve(null) : categoryListAPI(),
          categoryListTabAPI(categoryId),
        ])
        if (cancelled) return

        if (categoryList) {
          const matched = categoryList.find((category) => category.id === categoryId)
          if (matched) {
            setName(matched.name)
            setEmoji(matched.emoji ?? '')
          }
        }

        const resolvedTabs = Array.isArray(tabList) ? tabList : []
        setTabs(resolvedTabs)
        const firstTab = resolvedTabs[0]?.id ?? ''
        setTab(firstTab)
        await loadFirstPage(categoryId, firstTab, isCancelled)
      } catch {
        if (cancelled) return
        setStatus('error')
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [categoryId, hintName, reloadToken, loadFirstPage])

  const retry = () => {
    setStatus('loading')
    setTabs([])
    setTab('')
    setPodcasts([])
    setLoadMoreKey(undefined)
    setLoadingMore(false)
    setLoadMoreError(false)
    setReloadToken((token) => token + 1)
  }

  const selectTab = (tabKey: string) => {
    if (tabKey === tab) return
    setTab(tabKey)
    setStatus('loading')
    setPodcasts([])
    setLoadMoreKey(undefined)
    setLoadingMore(false)
    setLoadMoreError(false)
    void loadFirstPage(categoryId, tabKey)
  }

  const loadMore = () => {
    if (!loadMoreKey || loadingMore) return
    const token = requestRef.current
    setLoadingMore(true)
    setLoadMoreError(false)
    categoryPodcastListAPI({ categoryId, tab: tab || undefined, loadMoreKey })
      .then((page) => {
        if (token !== requestRef.current) return
        setPodcasts((prev) => [...prev, ...page.items.map((item) => item.podcast)])
        setLoadMoreKey(page.loadMoreKey)
      })
      .catch(() => {
        if (token === requestRef.current) setLoadMoreError(true)
      })
      .finally(() => setLoadingMore(false))
  }

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: status === 'ready' && Boolean(loadMoreKey) && !loadingMore && !loadMoreError,
  })

  const columns = columnsForWidth(width)
  const tileWidth =
    width > 0
      ? Math.max(120, Math.floor((width - GRID_GAP * (columns - 1)) / columns))
      : 160

  return (
    <div>
      <PageHeader
        back
        title={name || '分类'}
        aside={emoji || undefined}
        description="按标签筛选节目，滚动到底自动加载更多。"
        size="display"
      />

      {tabs.length > 1 && (
        <div className="mb-7 flex flex-wrap items-center gap-2" role="tablist" aria-label="分类标签">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === tab}
              className="pill"
              data-selected={item.id === tab}
              onClick={() => selectTab(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}

      {status === 'error' ? (
        <LoadError hint="这个分类的节目没能取回来，可能是网络或服务暂时不可用。" onRetry={retry} />
      ) : (
        <>
          <div
            ref={gridRef}
            className="grid gap-x-4 gap-y-7"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            aria-busy={status === 'loading'}
          >
            {status === 'loading'
              ? Array.from({ length: columns * 2 }).map((_, index) => (
                  <div key={index}>
                    <SkeletonBox className="w-full" style={{ aspectRatio: '1' }} rounded="lg" />
                    <SkeletonBox className="mt-2.5 h-[15px] w-[86%]" rounded="sm" />
                    <SkeletonBox className="mt-1.5 h-[12px] w-[54%]" rounded="sm" />
                  </div>
                ))
              : podcasts.map((podcast) => (
                  <PodcastTile key={podcast.pid} podcast={podcast} width={tileWidth} />
                ))}
          </div>

          {status === 'ready' && podcasts.length === 0 && (
            <EmptyState
              title="这个标签下还没有节目"
              hint="换一个标签，或去分类页看看别的主题。"
              action={
                <button
                  type="button"
                  className="pill pill-ink"
                  onClick={() => navigate('/categories')}
                >
                  去看分类
                </button>
              }
            />
          )}

          {loadingMore && (
            <div className="mt-8">
              <ShelfSkeleton count={4} tileWidth={tileWidth} />
            </div>
          )}

          {loadMoreError ? (
            <div className="dotted-top mt-8 py-8">
              <p className="m-0 type-sub">更多节目没能加载出来。</p>
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
