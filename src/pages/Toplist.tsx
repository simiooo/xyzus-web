import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { topListAPI } from '@/api/discovery'
import PageHeader from '@/components/ui/PageHeader'
import EpisodeRow from '@/components/rows/EpisodeRow'
import EmptyState from '@/components/ui/EmptyState'
import { EpisodeRowsSkeleton } from '@/components/ui/Skeleton'
import { formatPlayCount } from '@/utils/format'
import type { EpisodeBasic } from '@/api/types'

type ChartKey = 'HOT' | 'ROCK' | 'NEW'

interface ChartInfo {
  key: ChartKey
  title: string
  description: string
}

/**
 * 榜单的标题与说明按 category 本地给（后端只回单集列表，没有榜单元信息）。
 * 文案对齐产品定义：最热榜 / 锋芒榜 / 新星榜。
 */
const CHARTS: ChartInfo[] = [
  {
    key: 'HOT',
    title: '最热榜',
    description: '过去一周被收听最多的单集，大家都在听。',
  },
  {
    key: 'ROCK',
    title: '锋芒榜',
    description: '锋芒初露：正在被更多人听见的新锐单集。',
  },
  {
    key: 'NEW',
    title: '新星榜',
    description: '刚刚上线的新单集，先听为快。',
  },
]

function resolveChart(category?: string): ChartInfo {
  const key = (category ?? 'HOT').toUpperCase()
  return CHARTS.find((chart) => chart.key === key) ?? CHARTS[0]
}

/** 内容区错误态：一句中文说明 + 墨色重试按钮，不用弹窗和转圈 */
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

export default function Toplist() {
  const { category } = useParams<{ category: string }>()
  const chart = resolveChart(category)

  // 换榜时整体重挂，所有分页/加载状态归零，避免把上一个榜的状态带过来
  return <ChartBody key={chart.key} chart={chart} />
}

function ChartBody({ chart }: { chart: ChartInfo }) {
  const navigate = useNavigate()
  const [episodes, setEpisodes] = useState<EpisodeBasic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    topListAPI({ category: chart.key })
      .then((items) => {
        if (cancelled) return
        setEpisodes(Array.isArray(items) ? items : [])
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setEpisodes([])
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [chart.key, reloadToken])

  const retry = () => {
    setError(false)
    setLoading(true)
    setReloadToken((token) => token + 1)
  }

  const totalPlays = episodes.reduce((sum, episode) => sum + (episode.playCount || 0), 0)
  const stats =
    episodes.length > 0
      ? `共 ${episodes.length} 个单集${totalPlays > 0 ? ` · ${formatPlayCount(totalPlays)}` : ''}`
      : undefined

  return (
    <div>
      <PageHeader
        title={chart.title}
        aside={stats}
        description={chart.description}
        size="display"
      />

      <div className="mb-7 flex flex-wrap items-center gap-2" role="tablist" aria-label="切换榜单">
        {CHARTS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === chart.key}
            className="pill"
            data-selected={item.key === chart.key}
            onClick={() => navigate(`/toplist/${item.key}`)}
          >
            {item.title}
          </button>
        ))}
      </div>

      {loading ? (
        <EpisodeRowsSkeleton count={8} />
      ) : error ? (
        <LoadError hint="榜单数据没能取回来，可能是网络或服务暂时不可用。" onRetry={retry} />
      ) : episodes.length === 0 ? (
        <EmptyState
          title="这个榜单还没有内容"
          hint="榜单会定期更新，先回发现页逛逛别的单集吧。"
          action={
            <button type="button" className="pill pill-ink" onClick={() => navigate('/')}>
              去发现页
            </button>
          }
        />
      ) : (
        <>
          <p className="m-0 mb-2 type-section">上榜单集</p>
          <div className="row-grid">
            {episodes.map((episode, index) => (
              <div key={episode.eid} className={index > 0 ? 'dotted-top' : undefined}>
                <EpisodeRow episode={episode} rank={index + 1} />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 rounded-full py-1 pr-2 type-sub text-[var(--faint)] transition-colors hover:text-[var(--ink)]"
        >
          回到发现页
          <ArrowRight size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
