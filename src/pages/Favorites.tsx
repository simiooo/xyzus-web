import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Typography, Button, Empty } from 'antd'
import { ArrowLeftOutlined, HeartOutlined } from '@ant-design/icons'
import { favoriteEpisodeListAPI } from '@/api/episode'
import { formatDate, formatDuration } from '@/utils/format'
import type { EpisodeBasic } from '@/api/types'

const { Title, Text } = Typography

export default function Favorites() {
  const navigate = useNavigate()
  const [episodes, setEpisodes] = useState<EpisodeBasic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    favoriteEpisodeListAPI()
      .then((data) => setEpisodes(data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="mb-3">
        Back
      </Button>

      <Title level={4} className="!text-primary mb-4">My Favorites</Title>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer rounded-lg h-20" />
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <div className="py-16">
          <Empty description={<span className="text-secondary">No favorites yet</span>}>
            <span className="text-tertiary text-xs">Tap the heart icon on episodes to save them here</span>
          </Empty>
        </div>
      ) : (
        <div className="space-y-1">
          {episodes.map((ep) => (
            <div
              key={ep.eid}
              onClick={() => navigate(`/episode/${ep.eid}`)}
              className="flex gap-3 py-3 px-2 cursor-pointer rounded-lg list-hover transition-colors"
            >
              <img
                src={ep.image?.picUrl || ep.podcast?.image?.picUrl}
                alt=""
                className="w-[72px] h-[72px] rounded-md object-cover flex-shrink-0"
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
                  {ep.duration > 0 && <Text className="!text-tertiary">{formatDuration(ep.duration)}</Text>}
                  <Text className="!text-tertiary"><HeartOutlined /> {ep.favoriteCount}</Text>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
