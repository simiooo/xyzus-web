import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Heart } from 'lucide-react'
import { favoriteEpisodeListAPI } from '@/api/episode'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import EpisodeRow from '@/components/rows/EpisodeRow'
import { EpisodeRowsSkeleton } from '@/components/ui/Skeleton'
import type { EpisodeBasic } from '@/api/types'

/** 收藏接口一次返回全量，页面按批渐显，滚动到底继续追加下一批 */
const PAGE_SIZE = 20

/**
 * 我的收藏：标题 + 条数小字 + 单集行（带摘要）。
 * 空的时候给出一条去发现页的路径，不画卡片。
 */
export default function Favorites() {
  const navigate = useNavigate()

  const [episodes, setEpisodes] = useState<EpisodeBasic[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await favoriteEpisodeListAPI()
      setEpisodes(list || [])
      setVisibleCount(PAGE_SIZE)
    } catch {
      setError('收藏列表加载失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 不在 effect 体内同步 setState（react-hooks/set-state-in-effect）：推一个微任务再开始加载
    void Promise.resolve().then(() => load())
  }, [load])

  const revealMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(episodes.length, prev + PAGE_SIZE))
  }, [episodes.length])

  const sentinelRef = useInfiniteScroll(revealMore, {
    enabled: !loading && !error && visibleCount < episodes.length,
  })

  const total = episodes.length
  const hasMoreToReveal = visibleCount < total

  if (loading) {
    return (
      <div>
        <PageHeader title="我的收藏" size="headline" />
        <EpisodeRowsSkeleton count={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="我的收藏" size="headline" />
        <div className="mt-4">
          <p className="m-0 type-sub">{error}</p>
          <button type="button" className="pill pill-ink mt-4" onClick={() => void load()}>
            重试
          </button>
        </div>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div>
        <PageHeader title="我的收藏" size="headline" />
        <EmptyState
          title="还没有收藏的单集"
          hint="在单集页面点一下收藏，就会出现在这里。"
          action={
            <button type="button" className="pill pill-ink" onClick={() => navigate('/')}>
              <Heart size={15} strokeWidth={1.75} />
              去发现
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="我的收藏" aside={`${total} 个单集`} size="headline" />

      <div className="row-grid">
        {episodes.slice(0, visibleCount).map((episode, index) => (
          <div key={episode.eid} className={index > 0 ? 'dotted-top' : undefined}>
            <EpisodeRow episode={episode} showExcerpt showPodcast />
          </div>
        ))}
      </div>

      {hasMoreToReveal && <div ref={sentinelRef} className="h-px" aria-hidden />}
    </div>
  )
}
