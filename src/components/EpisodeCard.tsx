import { useNavigate } from 'react-router'
import { CaretRightOutlined, PauseOutlined } from '@ant-design/icons'
import useAudioStore from '@/stores/audioStore'
import type { EpisodeBasic } from '@/api/types'
import { formatDate, formatDuration } from '@/utils/format'

interface EpisodeCardProps {
  episode: EpisodeBasic
}

export default function EpisodeCard({ episode }: EpisodeCardProps) {
  const navigate = useNavigate()
  const { currentEpisode, isPlaying, play, togglePlay } = useAudioStore()
  const isCurrentEpisode = currentEpisode?.eid === episode.eid

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isCurrentEpisode) {
      togglePlay()
    } else {
      play(episode)
    }
  }

  const coverUrl = episode.image?.picUrl || episode.podcast?.image?.picUrl

  return (
    <div
      className="card-hover bg-surface rounded-lg border border-subtle min-w-[280px] max-w-[320px] cursor-pointer"
      onClick={() => navigate(`/episode/${episode.eid}`)}
    >
      <div className="flex gap-3 p-3">
        <div className="relative flex-shrink-0">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="w-[80px] h-[80px] rounded-md object-cover"
            />
          ) : (
            <div className="w-[80px] h-[80px] rounded-md bg-surface-elevated" />
          )}
          <button
            onClick={handlePlay}
            className="absolute bottom-1 right-1 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105"
            style={{ background: isCurrentEpisode && isPlaying ? '#FF7A45' : 'rgba(0,0,0,0.65)' }}
          >
            {isCurrentEpisode && isPlaying ? (
              <PauseOutlined style={{ color: '#fff', fontSize: 11 }} />
            ) : (
              <CaretRightOutlined style={{ color: '#fff', fontSize: 11 }} />
            )}
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-primary leading-[18px] line-clamp-2">
            {episode.title}
          </div>
          {episode.podcast?.title && (
            <div className="mt-1 text-xs text-tertiary truncate">
              {episode.podcast.title}
            </div>
          )}
          <div className="mt-1.5 flex gap-2 items-center text-xs text-tertiary">
            <span>{formatDate(episode.pubDate)}</span>
            {episode.duration > 0 && <span>{formatDuration(episode.duration)}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
