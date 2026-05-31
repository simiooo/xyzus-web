import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Typography, Button, Empty } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { topListAPI } from '@/api/discovery'
import { formatDate, formatDuration } from '@/utils/format'
import type { EpisodeBasic } from '@/api/types'

const { Title, Text, Paragraph } = Typography

const CATEGORY_MAP: Record<string, { title: string; description: string }> = {
  HOT: { title: 'Hottest', description: 'Most popular episodes this week' },
  ROCK: { title: 'Rock', description: 'Up-and-coming podcasts on the rise' },
  NEW: { title: 'New Star', description: 'Best new podcast discoveries' },
}

export default function Toplist() {
  const { category } = useParams<{ category: string }>()
  const navigate = useNavigate()

  const catInfo = CATEGORY_MAP[category?.toUpperCase() ?? ''] ?? CATEGORY_MAP.HOT
  const [episodes, setEpisodes] = useState<EpisodeBasic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!category) return
    setLoading(true)
    topListAPI({ category: category.toUpperCase() as 'HOT' | 'ROCK' | 'NEW' })
      .then((data) => setEpisodes(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [category])

  return (
    <div>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="mb-3">
        Back
      </Button>

      <div className="gradient-card-orange rounded-xl p-5 mb-4">
        <Title level={3} className="!text-white !m-0">{catInfo.title}</Title>
        <Paragraph className="!text-white/85 mt-2 !mb-0">
          {catInfo.description}
        </Paragraph>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer rounded-lg h-20" />
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <Empty description={<span className="text-secondary">No episodes found</span>} className="py-16" />
      ) : (
        <div>
          {episodes.map((ep, index) => (
            <div
              key={ep.eid}
              onClick={() => navigate(`/episode/${ep.eid}`)}
              className="flex gap-3 py-3 items-center cursor-pointer rounded-lg list-hover px-2"
            >
              <Text
                strong
                className="w-6 text-center"
                style={{ fontSize: 18, color: index < 3 ? '#FF7A45' : 'rgba(255,255,255,0.40)' }}
              >
                {index + 1}
              </Text>
              <img
                src={ep.image?.picUrl || ep.podcast?.image?.picUrl}
                alt=""
                className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="flex-1 min-w-0">
                <Text className="!text-primary" style={{ fontSize: 14 }} ellipsis={{ tooltip: ep.title }}>
                  {ep.title}
                </Text>
                <div className="mt-0.5">
                  <Text className="!text-tertiary" style={{ fontSize: 12 }}>{ep.podcast?.title}</Text>
                </div>
                <div className="mt-1 flex gap-2 text-xs">
                  <Text className="!text-tertiary">{formatDate(ep.pubDate)}</Text>
                  {ep.duration > 0 && (
                    <Text className="!text-tertiary">{formatDuration(ep.duration)}</Text>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
