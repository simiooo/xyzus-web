import { useNavigate } from 'react-router'
import useAudioStore from '@/stores/audioStore'
import SmartImage from '@/components/ui/SmartImage'
import PlayButton from '@/components/ui/PlayButton'
import { formatDuration } from '@/utils/format'
import type { EpisodeBasic } from '@/api/types'

interface EpisodeTileProps {
  episode: EpisodeBasic
  /** 固定像素宽度（货架在窄屏用）；不传则由容器（网格 / 货架）决定 */
  width?: number
  /** 是否显示节目名 */
  showPodcast?: boolean
}

/**
 * 货架里的单集封面卡：封面 + 两行标题 + 一行元信息。
 * 播放按钮是强调色的，只在悬停/聚焦（触屏上常驻）时浮在封面上。
 */
export default function EpisodeTile({ episode, width, showPodcast = true }: EpisodeTileProps) {
  const navigate = useNavigate()
  const currentEpisode = useAudioStore((s) => s.currentEpisode)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const play = useAudioStore((s) => s.play)
  const togglePlay = useAudioStore((s) => s.togglePlay)

  const isCurrent = currentEpisode?.eid === episode.eid
  const image = episode.image ?? episode.podcast?.image

  const handlePlay = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (isCurrent) {
      togglePlay()
    } else {
      play(episode)
    }
  }

  return (
    <div className="group w-full cursor-pointer" style={width ? { width } : undefined} onClick={() => navigate(`/episode/${episode.eid}`)}>
      <div className="relative">
        <SmartImage
          image={image}
          aspectRatio={1}
          rounded="lg"
          priority={false}
          className="w-full"
          alt={episode.title}
        />
        <div
          className={`absolute bottom-2.5 right-2.5 transition-all duration-150 ${
            isCurrent
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100'
          }`}
        >
          <PlayButton
            size="sm"
            variant={isCurrent ? 'accent' : 'accent'}
            playing={isCurrent && isPlaying}
            onClick={handlePlay}
            label={`${isCurrent && isPlaying ? '暂停' : '播放'} ${episode.title}`}
            className="shadow-float"
          />
        </div>
      </div>

      <p className="m-0 mt-2.5 type-row-title line-clamp-2 text-[var(--ink)]">{episode.title}</p>

      <div className="mt-1 flex items-center gap-1.5 type-meta">
        {showPodcast && episode.podcast?.title && (
          <span className="min-w-0 truncate">{episode.podcast.title}</span>
        )}
        {showPodcast && episode.podcast?.title && episode.duration > 0 && <span aria-hidden>·</span>}
        {episode.duration > 0 && <span className="flex-shrink-0 tabnum">{formatDuration(episode.duration)}</span>}
      </div>
    </div>
  )
}
