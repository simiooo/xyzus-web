import { useNavigate } from 'react-router'
import SmartImage from '@/components/ui/SmartImage'
import { formatCount } from '@/utils/format'
import type { PodcastBasic } from '@/api/types'

interface PodcastTileProps {
  podcast: PodcastBasic
  width?: number
  /** 显示订阅数（默认显示） */
  showCount?: boolean
}

/** 货架里的节目封面卡：封面 + 两行标题 + 作者/订阅数 */
export default function PodcastTile({ podcast, width, showCount = true }: PodcastTileProps) {
  const navigate = useNavigate()

  return (
    <div className="group w-full cursor-pointer" style={width ? { width } : undefined} onClick={() => navigate(`/podcast/${podcast.pid}`)}>
      <SmartImage image={podcast.image} aspectRatio={1} rounded="lg" className="w-full" alt={podcast.title} />

      <p className="m-0 mt-2.5 type-manage line-clamp-2 text-[var(--ink)]">{podcast.title}</p>

      <div className="mt-1 flex items-center gap-1.5 type-meta">
        {podcast.author && <span className="min-w-0 truncate">{podcast.author}</span>}
        {showCount && podcast.subscriptionCount > 0 && (
          <>
            {podcast.author && <span aria-hidden>·</span>}
            <span className="flex-shrink-0">{formatCount(podcast.subscriptionCount)}订阅</span>
          </>
        )}
      </div>
    </div>
  )
}
