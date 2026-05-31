import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Typography, Button, Empty } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { categoryPodcastListAPI, categoryListTabAPI } from '@/api/category'
import PodcastCard from '@/components/PodcastCard'
import type { PodcastBasic } from '@/api/types'

const { Title } = Typography

interface TabItem {
  key: string
  name: string
}

function normalizeTabs(data: unknown): TabItem[] {
  if (!Array.isArray(data)) return []
  return data.map((t: unknown) => {
    if (typeof t === 'string') return { key: t, name: t }
    const obj = t as Record<string, unknown>
    return {
      key: (obj.id || obj.key || obj.name || '') as string,
      name: (obj.name || obj.label || obj.id || '') as string,
    }
  })
}

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [podcasts, setPodcasts] = useState<PodcastBasic[]>([])
  const [loading, setLoading] = useState(true)
  const [tabs, setTabs] = useState<TabItem[]>([])
  const [activeTab, setActiveTab] = useState('')

  const loadPodcasts = useCallback((categoryId: string, tab: string) => {
    setLoading(true)
    categoryPodcastListAPI({ categoryId, tab })
      .then((res) => setPodcasts(res.data.map((item) => item.podcast)))
      .catch(() => setPodcasts([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    categoryListTabAPI(id)
      .then((res) => {
        const tabList = normalizeTabs(res.data)
        setTabs(tabList)
        const firstKey = tabList[0]?.key || ''
        setActiveTab(firstKey)
        if (firstKey) {
          loadPodcasts(id, firstKey)
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [id, loadPodcasts])

  const handleTabChange = (key: string) => {
    if (!id || key === activeTab) return
    setActiveTab(key)
    loadPodcasts(id, key)
  }

  return (
    <div>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="mb-3">
        Back
      </Button>

      <Title level={4} className="!text-primary mb-4">Category</Title>

      {tabs.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-1.5 rounded-full text-sm transition-all duration-150 border-0 cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-accent-primary text-white'
                  : 'bg-surface text-secondary hover:text-primary hover:bg-surface-elevated'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex gap-3 flex-wrap">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="shimmer rounded-lg w-[160px] h-[220px]" />
          ))}
        </div>
      ) : podcasts.length === 0 ? (
        <Empty description={<span className="text-secondary">No podcasts in this category</span>} className="py-16" />
      ) : (
        <div className="flex gap-3 flex-wrap">
          {podcasts.map((podcast) => (
            <PodcastCard key={podcast.pid} podcast={podcast} />
          ))}
        </div>
      )}
    </div>
  )
}
