import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Input, Tabs, Typography, Skeleton, Empty, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { searchAPI, searchPresetAPI } from '@/api/search'
import useAppStore from '@/stores/appStore'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import EpisodeCard from '@/components/EpisodeCard'
import PodcastCard from '@/components/PodcastCard'
import type { PodcastBasic, EpisodeBasic, UserBasic, SearchRawItem, SearchLoadMoreKey } from '@/api/types'

const { Text, Paragraph } = Typography

type SearchType = 'ALL' | 'PODCAST' | 'EPISODE' | 'USER'

function isPodcast(item: PodcastBasic | EpisodeBasic | UserBasic): item is PodcastBasic {
  return item.type === 'PODCAST'
}

function isEpisode(item: PodcastBasic | EpisodeBasic | UserBasic): item is EpisodeBasic {
  return item.type === 'EPISODE'
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { addSearchHistory } = useAppStore()

  const keyword = searchParams.get('keyword') || ''
  const [inputValue, setInputValue] = useState(keyword)
  const [activeTab, setActiveTab] = useState<SearchType>('ALL')
  const [results, setResults] = useState<SearchRawItem[]>([])
  const [presets, setPresets] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadMoreKey, setLoadMoreKey] = useState<SearchLoadMoreKey | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const genRef = useRef(0)

  useEffect(() => {
    searchPresetAPI().then((r) => {
      setPresets(r.data.map((item) => item.text))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setInputValue(keyword)
  }, [keyword])

  useEffect(() => {
    if (!keyword) { setResults([]); return }
    const gen = ++genRef.current
    setLoading(true)
    setLoadMoreKey(undefined)
    setHasMore(false)
    searchAPI({ keyword, type: activeTab })
      .then((r) => {
        if (gen === genRef.current) {
          setResults(r.data || [])
          setLoadMoreKey(r.loadMoreKey)
          setHasMore(!!r.loadMoreKey)
          addSearchHistory(keyword)
        }
      })
      .catch(() => {
        if (gen === genRef.current) setResults([])
      })
      .finally(() => {
        if (gen === genRef.current) setLoading(false)
      })
  }, [keyword, activeTab, addSearchHistory])

  const loadMore = useCallback(async () => {
    if (!keyword || !loadMoreKey) return
    const gen = ++genRef.current
    try {
      const r = await searchAPI({ keyword, type: activeTab, loadMoreKey })
      if (gen === genRef.current) {
        setResults((prev) => [...prev, ...(r.data || [])])
        setLoadMoreKey(r.loadMoreKey)
        setHasMore(!!r.loadMoreKey)
      }
    } catch {
      // handled by alova
    }
  }, [keyword, activeTab, loadMoreKey])

  const sentinelRef = useInfiniteScroll(loadMore, { enabled: hasMore && !loading })

  interface SearchSection {
    header?: string
    footer?: string
    items: (PodcastBasic | EpisodeBasic)[]
    users?: UserBasic[]
  }

  const sections = useMemo(() => {
    const groups: SearchSection[] = []
    let current: SearchSection = { items: [] }
    for (const item of results) {
      if (item.type === 'HEADER') {
        if (current.items.length > 0 || current.users) { groups.push(current); current = { items: [] } }
        current.header = item.title
      } else if (item.type === 'FOOTER') {
        current.footer = item.title
        groups.push(current)
        current = { items: [] }
      } else if (item.type === 'SEARCHED_USERS') {
        if (current.items.length > 0) { groups.push(current); current = { items: [] } }
        current.users = item.users
        groups.push(current)
        current = { items: [] }
      } else if (item.type === 'PODCAST' || item.type === 'EPISODE') {
        current.items.push(item)
      } else if (item.type === 'USER') {
        if (!current.users) current.users = []
        current.users.push(item)
      }
    }
    if (current.items.length > 0 || current.users || current.header) groups.push(current)
    return groups
  }, [results])

  const handleSearch = (value: string) => {
    if (value.trim()) {
      setSearchParams({ keyword: value.trim() })
    }
  }

  const handlePresetClick = (tag: string) => {
    setInputValue(tag)
    setSearchParams({ keyword: tag })
  }

  return (
    <div>
      <Input
        size="large"
        prefix={<SearchOutlined />}
        placeholder="Search podcasts, episodes, people..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onPressEnter={() => handleSearch(inputValue)}
        className="!rounded-full mb-4"
      />

      {!keyword && presets.length > 0 && (
        <div className="bg-surface rounded-lg border border-subtle p-4 mb-4">
          <Text strong className="!text-primary text-sm block mb-3">You might want to search</Text>
          <div className="flex gap-2 flex-wrap">
            {presets.map((tag) => (
              <Tag
                key={tag}
                className="cursor-pointer !px-3 !py-1 !rounded-full"
                onClick={() => handlePresetClick(tag)}
              >
                {tag}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {keyword && (
        <Tabs
          activeKey={activeTab}
          onChange={(key) => { setActiveTab(key as SearchType); setResults([]); setLoadMoreKey(undefined); setHasMore(false) }}
          items={[
            { key: 'ALL', label: 'All' },
            { key: 'PODCAST', label: 'Podcasts' },
            { key: 'EPISODE', label: 'Episodes' },
            { key: 'USER', label: 'Users' },
          ]}
        />
      )}

      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : keyword && results.length === 0 ? (
        <div className="text-center py-16">
          <Empty description={<span className="text-secondary">{`No results for "${keyword}"`}</span>} />
        </div>
      ) : (
        <>
          {sections.map((section, idx) => (
            <div key={idx} className="mb-4">
              {section.header && (
                <div className="flex justify-between items-center mb-3">
                  <Text strong className="!text-primary" style={{ fontSize: 15 }}>{section.header}</Text>
                </div>
              )}
              {section.users ? (
                <div>
                  {section.users.map((user) => (
                    <div key={user.uid} className="flex gap-2.5 cursor-pointer items-center py-2 rounded-lg list-hover px-2">
                      <img
                        src={user.avatar?.picture?.thumbnailUrl}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <div>
                        <Text className="!text-primary" strong>{user.nickname}</Text>
                        {user.ipLoc && <Text className="!text-tertiary" style={{ marginLeft: 6, fontSize: 12 }}>{user.ipLoc}</Text>}
                        {user.bio && <Paragraph className="!text-secondary !mb-0" style={{ fontSize: 12 }} ellipsis={{ rows: 1 }}>{user.bio}</Paragraph>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-3 flex-wrap">
                  {section.items.map((item) => {
                    if (isPodcast(item)) return <PodcastCard key={item.pid} podcast={item} />
                    if (isEpisode(item)) return <EpisodeCard key={item.eid} episode={item} />
                    return null
                  })}
                </div>
              )}
              {section.footer && <div className="h-px bg-border-subtle my-3" />}
            </div>
          ))}
          {hasMore && <div ref={sentinelRef} className="h-[1px]" />}
        </>
      )}
    </div>
  )
}
