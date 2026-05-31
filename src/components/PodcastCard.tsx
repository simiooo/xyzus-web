import { useNavigate } from 'react-router'
import { Typography } from 'antd'
import type { PodcastBasic } from '@/api/types'

const { Text } = Typography

interface PodcastCardProps {
  podcast: PodcastBasic
}

export default function PodcastCard({ podcast }: PodcastCardProps) {
  const navigate = useNavigate()

  return (
    <div
      className="card-hover w-[160px] cursor-pointer"
      onClick={() => navigate(`/podcast/${podcast.pid}`)}
    >
      {podcast.image?.picUrl ? (
        <img
          src={podcast.image.picUrl}
          alt=""
          className="w-full aspect-square rounded-lg object-cover"
        />
      ) : (
        <div className="w-full aspect-square rounded-lg bg-surface-elevated" />
      )}
      <Text className="!text-primary block mt-1.5 text-xs font-semibold truncate">
        {podcast.title}
      </Text>
      {podcast.author && (
        <Text className="!text-tertiary block text-xs truncate">
          {podcast.author}
        </Text>
      )}
    </div>
  )
}
