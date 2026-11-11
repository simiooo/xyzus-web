import { useNavigate } from 'react-router'
import SmartImage from '@/components/ui/SmartImage'
import { formatCount } from '@/utils/format'
import type { PodcastBasic } from '@/api/types'

interface PodcastRowProps {
  podcast: PodcastBasic
  /** 显示节目简介摘要 */
  showBrief?: boolean
  /** 行尾内容（订阅按钮等） */
  trailing?: React.ReactNode
}

/** 一行一件事：节目行（订阅列表、相关节目、搜索节目结果） */
export default function PodcastRow({ podcast, showBrief = true, trailing }: PodcastRowProps) {
  const navigate = useNavigate()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/podcast/${podcast.pid}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/podcast/${podcast.pid}`)
        }
      }}
      className="row row-pressable"
      style={{ alignItems: 'center' }}
    >
      <SmartImage
        image={podcast.image}
        aspectRatio={1}
        rounded="md"
        className="h-14 w-14 flex-shrink-0"
        alt={podcast.title}
      />

      <div className="min-w-0 flex-1">
        <p className="m-0 type-manage line-clamp-1 text-[var(--ink)]">{podcast.title}</p>

        <div className="mt-1 flex items-center gap-1.5 type-meta">
          {podcast.author && <span className="min-w-0 truncate">{podcast.author}</span>}
          {podcast.subscriptionCount > 0 && (
            <>
              {podcast.author && <span aria-hidden>·</span>}
              <span className="flex-shrink-0">{formatCount(podcast.subscriptionCount)}订阅</span>
            </>
          )}
          {podcast.episodeCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="flex-shrink-0">{podcast.episodeCount} 集</span>
            </>
          )}
        </div>

        {showBrief && podcast.brief && (
          <p className="m-0 mt-1 type-sub line-clamp-1">{podcast.brief}</p>
        )}
      </div>

      {trailing && <div className="flex flex-shrink-0 items-center self-center">{trailing}</div>}
    </div>
  )
}
