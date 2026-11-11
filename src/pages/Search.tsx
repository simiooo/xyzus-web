import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { searchAPI, searchPresetAPI } from '@/api/search'
import useAppStore from '@/stores/appStore'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import PageHeader from '@/components/ui/PageHeader'
import SectionHead from '@/components/ui/SectionHead'
import SearchField from '@/components/shell/SearchField'
import SmartImage from '@/components/ui/SmartImage'
import PodcastRow from '@/components/rows/PodcastRow'
import EpisodeRow from '@/components/rows/EpisodeRow'
import EmptyState from '@/components/ui/EmptyState'
import { EpisodeRowsSkeleton, SkeletonBox } from '@/components/ui/Skeleton'
import type {
  EpisodeBasic,
  PodcastBasic,
  SearchLoadMoreKey,
  SearchPresetItem,
  SearchRawItem,
  UserBasic,
} from '@/api/types'

type SearchTab = 'ALL' | 'PODCAST' | 'EPISODE' | 'USER'

const TABS: { key: SearchTab; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'PODCAST', label: '节目' },
  { key: 'EPISODE', label: '单集' },
  { key: 'USER', label: '用户' },
]

interface ResultBlock {
  key: string
  heading?: string
  podcasts: PodcastBasic[]
  episodes: EpisodeBasic[]
  users: UserBasic[]
}

/**
 * 把搜索接口的混合结果（HEADER / FOOTER / PODCAST / EPISODE / USER / SEARCHED_USERS）
 * 分组成「标题 + 行列表」。FOOTER 只是接口的「继续加载」提示，页面用无限滚动代替。
 */
function buildBlocks(items: SearchRawItem[]): ResultBlock[] {
  const blocks: ResultBlock[] = []
  let index = 0
  let current: ResultBlock = { key: 'block-0', podcasts: [], episodes: [], users: [] }

  const startNew = (heading?: string) => {
    blocks.push(current)
    index += 1
    current = { key: `block-${index}`, heading, podcasts: [], episodes: [], users: [] }
  }

  for (const item of items) {
    switch (item.type) {
      case 'HEADER':
        startNew(item.title)
        break
      case 'FOOTER':
        startNew()
        break
      case 'PODCAST':
        current.podcasts.push(item)
        break
      case 'EPISODE':
        current.episodes.push(item)
        break
      case 'USER':
        current.users.push(item)
        break
      case 'SEARCHED_USERS': {
        const currentHasContent =
          current.podcasts.length + current.episodes.length + current.users.length > 0
        if (currentHasContent) {
          startNew('用户')
        } else if (!current.heading) {
          current.heading = '用户'
        }
        current.users.push(...item.users)
        break
      }
    }
  }

  blocks.push(current)

  return blocks.filter(
    (block) =>
      Boolean(block.heading) ||
      block.podcasts.length + block.episodes.length + block.users.length > 0,
  )
}

function TextTabs({ active, onChange }: { active: SearchTab; onChange: (tab: SearchTab) => void }) {
  return (
    <div className="mb-7 flex flex-wrap items-center gap-6" role="tablist" aria-label="搜索结果类型">
      {TABS.map((tab) => {
        const selected = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={`relative cursor-pointer border-0 bg-transparent px-0 pb-1.5 text-[14px] font-medium transition-colors ${
              selected
                ? 'text-[var(--ink)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--ink)]'
            }`}
          >
            {tab.label}
            {selected && (
              <span
                aria-hidden
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-sm bg-[var(--accent)]"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

function UserResultRow({ user }: { user: UserBasic }) {
  const meta = [user.bio?.trim(), user.ipLoc?.trim()].filter(Boolean).join(' · ')
  return (
    <div className="flex items-start gap-3.5 py-3.5">
      <SmartImage
        image={user.avatar?.picture}
        aspectRatio={1}
        rounded="full"
        className="h-10 w-10 flex-shrink-0"
        alt={user.nickname}
      />
      <div className="min-w-0 flex-1">
        <p className="m-0 type-manage text-[var(--ink)]">{user.nickname}</p>
        {meta && <p className="m-0 mt-0.5 line-clamp-1 type-sub">{meta}</p>}
      </div>
    </div>
  )
}

function LoadError({ hint, onRetry }: { hint: string; onRetry: () => void }) {
  return (
    <div className="py-12">
      <p className="m-0 type-title text-[var(--ink)]">搜索没能完成</p>
      <p className="m-0 mt-2 max-w-[420px] type-sub">{hint}</p>
      <button type="button" onClick={onRetry} className="pill pill-ink mt-5">
        重试
      </button>
    </div>
  )
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const addSearchHistory = useAppStore((state) => state.addSearchHistory)
  const keyword = (searchParams.get('keyword') ?? '').trim()

  const [activeTab, setActiveTab] = useState<SearchTab>('ALL')
  const [items, setItems] = useState<SearchRawItem[]>([])
  const [loadMoreKey, setLoadMoreKey] = useState<SearchLoadMoreKey | undefined>()
  const [view, setView] = useState<{ keyword: string; tab: SearchTab }>({ keyword: '', tab: 'ALL' })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [presets, setPresets] = useState<SearchPresetItem[]>([])
  const [presetsLoading, setPresetsLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)
  const requestRef = useRef<{ keyword: string; tab: SearchTab }>({ keyword: '', tab: 'ALL' })

  // 预设搜索词只取一次
  useEffect(() => {
    let cancelled = false
    searchPresetAPI()
      .then((list) => {
        if (cancelled) return
        setPresets(Array.isArray(list) ? list : [])
        setPresetsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setPresetsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!keyword) return
    requestRef.current = { keyword, tab: activeTab }
    let cancelled = false

    searchAPI({ keyword, type: activeTab })
      .then((page) => {
        if (cancelled) return
        setItems(Array.isArray(page.items) ? page.items : [])
        setLoadMoreKey(page.loadMoreKey)
        setView({ keyword, tab: activeTab })
        setStatus('ready')
        setLoadingMore(false)
        setLoadMoreError(false)
        addSearchHistory(keyword)
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
        setLoadMoreKey(undefined)
        setView({ keyword, tab: activeTab })
        setStatus('error')
        setLoadingMore(false)
      })

    return () => {
      cancelled = true
    }
  }, [keyword, activeTab, reloadToken, addSearchHistory])

  const loadMore = () => {
    if (!keyword || !loadMoreKey || loadingMore) return
    const request = { keyword, tab: activeTab }
    setLoadingMore(true)
    setLoadMoreError(false)

    searchAPI({ keyword, type: activeTab, loadMoreKey })
      .then((page) => {
        const latest = requestRef.current
        if (latest.keyword !== request.keyword || latest.tab !== request.tab) return
        setItems((prev) => [...prev, ...(Array.isArray(page.items) ? page.items : [])])
        setLoadMoreKey(page.loadMoreKey)
      })
      .catch(() => {
        const latest = requestRef.current
        if (latest.keyword === request.keyword && latest.tab === request.tab) {
          setLoadMoreError(true)
        }
      })
      .finally(() => setLoadingMore(false))
  }

  const blocks = useMemo(() => buildBlocks(items), [items])
  const hasResults = blocks.some(
    (block) => block.podcasts.length + block.episodes.length + block.users.length > 0,
  )
  const stale = view.keyword !== keyword || view.tab !== activeTab
  const effectiveStatus = keyword ? (stale ? 'loading' : status) : 'idle'

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: effectiveStatus === 'ready' && Boolean(loadMoreKey) && !loadingMore && !loadMoreError,
  })

  const retry = () => {
    setStatus('loading')
    setLoadMoreError(false)
    setReloadToken((token) => token + 1)
  }

  const changeTab = (tab: SearchTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    setLoadMoreError(false)
    setLoadingMore(false)
  }

  return (
    <div>
      <PageHeader
        title="搜索"
        aside={keyword ? `“${keyword}”` : undefined}
        description={keyword ? undefined : '搜节目、单集或用户。'}
        size="display"
      />

      {/* 顶栏的搜索框在手机上收起成图标，页面在移动端保留唯一的输入框 */}
      <SearchField className="mb-6 sm:hidden" />

      {!keyword ? (
        presetsLoading ? (
          <div className="flex flex-wrap gap-2" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <SkeletonBox key={index} className="h-8 w-[84px]" rounded="full" />
            ))}
          </div>
        ) : presets.length > 0 ? (
          <div>
            <p className="m-0 mb-3 type-section">大家都在搜</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.text}
                  type="button"
                  className="pill"
                  onClick={() => setSearchParams({ keyword: preset.text })}
                >
                  {preset.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="m-0 type-sub">输入关键词开始搜索。</p>
        )
      ) : (
        <>
          <TextTabs active={activeTab} onChange={changeTab} />

          {effectiveStatus === 'loading' ? (
            <div aria-busy="true">
              <SkeletonBox className="h-[13px] w-[100px]" rounded="sm" />
              <div className="mt-4">
                <EpisodeRowsSkeleton count={6} />
              </div>
            </div>
          ) : effectiveStatus === 'error' ? (
            <LoadError hint="请求没有返回结果，可能是网络或服务暂时不可用。" onRetry={retry} />
          ) : !hasResults ? (
            <EmptyState
              title={`没有找到“${keyword}”相关的内容`}
              hint="换个关键词，或点上面的搜索词再试一次。"
            />
          ) : (
            <>
              <div className="space-y-9">
                {blocks.map((block) => (
                  <section key={block.key}>
                    {block.heading && (
                      <SectionHead title={block.heading} level="section" className="mb-1" />
                    )}

                    {block.podcasts.length > 0 && (
                      <div className="row-grid">
                        {block.podcasts.map((podcast, index) => (
                          <div key={podcast.pid} className={index > 0 ? 'dotted-top' : undefined}>
                            <PodcastRow podcast={podcast} />
                          </div>
                        ))}
                      </div>
                    )}

                    {block.episodes.length > 0 && (
                      <div className="row-grid">
                        {block.episodes.map((episode, index) => (
                          <div key={episode.eid} className={index > 0 ? 'dotted-top' : undefined}>
                            <EpisodeRow episode={episode} showExcerpt />
                          </div>
                        ))}
                      </div>
                    )}

                    {block.users.length > 0 && (
                      <div className="row-grid">
                        {block.users.map((user, index) => (
                          <div key={user.uid} className={index > 0 ? 'dotted-top' : undefined}>
                            <UserResultRow user={user} />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {loadingMore && (
                <div className="mt-8">
                  <EpisodeRowsSkeleton count={2} cover={false} />
                </div>
              )}

              {loadMoreError ? (
                <div className="dotted-top mt-6 py-8">
                  <p className="m-0 type-sub">更多结果没能加载出来。</p>
                  <button type="button" onClick={loadMore} className="pill pill-ink mt-4">
                    重试
                  </button>
                </div>
              ) : (
                loadMoreKey && <div ref={sentinelRef} className="h-1" aria-hidden />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
