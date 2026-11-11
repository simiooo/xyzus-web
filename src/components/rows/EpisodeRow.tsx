import { useNavigate } from 'react-router'
import useAudioStore from '@/stores/audioStore'
import SmartImage from '@/components/ui/SmartImage'
import PlayButton from '@/components/ui/PlayButton'
import { formatDate, formatDuration, formatRelativeDate } from '@/utils/format'
import type { EpisodeBasic } from '@/api/types'

interface EpisodeRowProps {
  episode: EpisodeBasic
  /** 榜单里的名次 */
  rank?: number
  /** 显示所属节目名（跨节目的列表用） */
  showPodcast?: boolean
  /** 显示简介摘要（搜索结果、精选用） */
  showExcerpt?: boolean
  /** 显示封面（紧凑列表可以关掉） */
  showCover?: boolean
  /** 行尾是否显示时长 */
  showDuration?: boolean
  /** 是否显示行尾播放按钮（分类块的条目可能只有部分字段，不提供播放） */
  showPlay?: boolean
  /** 日期读法：绝对日期或相对时间 */
  dateStyle?: 'absolute' | 'relative' | 'none'
}

/**
 * 一行一件事：单集行。整行可点进单集详情，行尾的播放按钮不导航、直接播。
 * 正在播放的那一行，播放控件变成强调色的均衡器 —— 强调色只标记「当下」。
 */
export default function EpisodeRow({
  episode,
  rank,
  showPodcast = true,
  showExcerpt = false,
  showCover = true,
  showDuration = true,
  showPlay = true,
  dateStyle = 'absolute',
}: EpisodeRowProps) {
  const navigate = useNavigate()
  const currentEpisode = useAudioStore((s) => s.currentEpisode)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const play = useAudioStore((s) => s.play)
  const togglePlay = useAudioStore((s) => s.togglePlay)

  const isCurrent = currentEpisode?.eid === episode.eid
  const image = episode.image ?? episode.podcast?.image

  const dateText =
    dateStyle === 'none'
      ? ''
      : dateStyle === 'relative'
        ? formatRelativeDate(episode.pubDate)
        : formatDate(episode.pubDate)

  const meta = [showPodcast ? episode.podcast?.title : null, dateText].filter(
    Boolean,
  ) as string[]

  const handlePlay = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (isCurrent) {
      togglePlay()
    } else {
      play(episode)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/episode/${episode.eid}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/episode/${episode.eid}`)
        }
      }}
      className="row row-pressable group"
      style={{ alignItems: 'center' }}
    >
      {typeof rank === 'number' && (
        <span
          className="w-8 flex-shrink-0 self-center text-right type-value"
          style={{ color: rank <= 3 ? 'var(--ink)' : undefined }}
        >
          {rank}
        </span>
      )}

      {showCover && (
        <SmartImage
          image={image}
          aspectRatio={1}
          rounded="md"
          className="h-16 w-16 flex-shrink-0"
          alt={episode.title}
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="m-0 type-row-title line-clamp-2 text-[var(--ink)]">{episode.title}</p>

        {showExcerpt && episode.description && (
          <p className="m-0 mt-1 type-sub line-clamp-1">{episode.description}</p>
        )}

        {(meta.length > 0 || (showDuration && episode.duration > 0)) && (
          <div className="mt-1.5 flex items-center gap-2 type-meta">
            {meta.length > 0 && <span className="min-w-0 truncate">{meta.join(' · ')}</span>}
            {showDuration && episode.duration > 0 && (
              <>
                {meta.length > 0 && (
                  <span aria-hidden className="flex-shrink-0">
                    ·
                  </span>
                )}
                <span className="flex-shrink-0 whitespace-nowrap tabnum">
                  {formatDuration(episode.duration)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {showPlay && (
        <div className="flex flex-shrink-0 items-center gap-1.5 self-center">
          {isCurrent ? (
            <PlayButton
              size="sm"
              variant="accent"
              playing={isPlaying}
              onClick={handlePlay}
              label={isPlaying ? '暂停' : '继续播放'}
            />
          ) : (
            <PlayButton
              size="sm"
              variant="outline"
              onClick={handlePlay}
              label={`播放 ${episode.title}`}
            />
          )}
        </div>
      )}
    </div>
  )
}
