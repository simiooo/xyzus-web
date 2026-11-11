import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronUp, MessageCircle } from 'lucide-react'
import useAudioStore from '@/stores/audioStore'
import useUiStore from '@/stores/uiStore'
import SmartImage from '@/components/ui/SmartImage'
import PlayButton from '@/components/ui/PlayButton'
import VolumeControl from './VolumeControl'
import WaveSeekbar from '@/components/ui/WaveSeekbar'
import { formatCount, formatDurationShort } from '@/utils/format'

/**
 * 常驻播放条。整条只有播放控件用强调色：它是「正在播」这件事唯一的标记。
 * 移动端浮在底栏之上；桌面端贴着左栏右缘。
 */
export default function PlayerBar() {
  const navigate = useNavigate()
  const currentEpisode = useAudioStore((s) => s.currentEpisode)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const currentTime = useAudioStore((s) => s.currentTime)
  const duration = useAudioStore((s) => s.duration)
  const togglePlay = useAudioStore((s) => s.togglePlay)
  const seekTo = useAudioStore((s) => s.seekTo)
  const isLoading = useAudioStore((s) => s.isLoading)
  const togglePlayerSheet = useUiStore((s) => s.togglePlayerSheet)
  const sheetOpen = useUiStore((s) => s.playerSheetOpen)
  const toggleComments = useUiStore((s) => s.toggleComments)
  const commentsOpen = useUiStore((s) => s.commentsOpen)

  // 拖动进度时的本地值（带集 id，避免换台后把旧值带过来），松手才真正跳转
  const [seeking, setSeeking] = useState<{ eid: string; value: number } | null>(null)

  // 展开播放器时把播放条收起来：展开面板里已有完整的走带，
  // 两条同时露出来既重复又会被遮罩压暗。
  if (!currentEpisode || sheetOpen) return null

  const image = currentEpisode.image ?? currentEpisode.podcast?.image
  const total = duration > 0 ? duration : currentEpisode.duration || 0
  const shown =
    seeking && seeking.eid === currentEpisode.eid ? seeking.value : currentTime
  const percent = total > 0 ? Math.min(100, (shown / total) * 100) : 0


  return (
    <div className="pointer-events-none fixed bottom-[var(--tabbar-h)] left-0 right-0 z-[41] lg:bottom-0">
      {/* 与外壳同宽居中：左栏位置用 padding 让出来，超宽屏下和内容区对齐 */}
      <div className="pointer-events-auto mx-auto w-full max-w-[var(--shell-max)] lg:pl-[var(--rail)]">
        {/* 进度发丝线：强调色的另一个合法位置（移动端只有它） */}
        <div className="mx-3 h-[3px] rounded-full bg-[var(--muted-strong)] md:hidden" aria-hidden>
          <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-150 ease-linear" style={{ width: `${percent}%` }} />
        </div>

        <div className="flex h-[var(--player-h)] items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 lg:px-5">
        <SmartImage
          image={image}
          aspectRatio={1}
          rounded="md"
          priority
          className="h-12 w-12 flex-shrink-0 cursor-pointer lg:h-[52px] lg:w-[52px]"
          alt={currentEpisode.title}
        />
        <button
          type="button"
          onClick={() => togglePlayerSheet()}
          className="hidden lg:block min-w-0 flex-1 border-0 bg-transparent p-0 text-left cursor-pointer"
          aria-label="展开播放器"
        >
          <p className="m-0 type-manage line-clamp-1 text-[var(--ink)]">{currentEpisode.title}</p>
          {currentEpisode.podcast?.title && (
            <p className="m-0 mt-0.5 type-meta line-clamp-1">{currentEpisode.podcast.title}</p>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate(`/episode/${currentEpisode.eid}`)}
          className="lg:hidden min-w-0 flex-1 border-0 bg-transparent p-0 text-left cursor-pointer"
          aria-label="打开单集详情"
        >
          <p className="m-0 type-manage line-clamp-1 text-[var(--ink)]">{currentEpisode.title}</p>
          {currentEpisode.podcast?.title && (
            <p className="m-0 mt-0.5 type-meta line-clamp-1">{currentEpisode.podcast.title}</p>
          )}
        </button>

        <PlayButton size="md" variant="accent" playing={isPlaying} loading={isLoading} onClick={togglePlay} label={isPlaying ? '暂停' : '播放'} />

        <div className="hidden w-[min(46%,440px)] flex-none flex-col justify-center md:flex">
          <div className="flex items-center justify-between type-meta tabnum text-[var(--muted-foreground)]">
            <span>{formatDurationShort(shown)}</span>
            <span>{formatDurationShort(total)}</span>
          </div>
          <WaveSeekbar
            value={Math.round(shown)}
            max={Math.max(1, Math.round(total))}
            playing={isPlaying}
            label="播放进度"
            bars={52}
            onChange={(v) => setSeeking({ eid: currentEpisode.eid, value: v })}
            onChangeComplete={(v) => {
              seekTo(v)
              setSeeking(null)
            }}
          />
        </div>

        <div className="ml-auto flex items-center gap-1 lg:gap-1.5">
          <VolumeControl className="hidden lg:block" />

          <button
            type="button"
            onClick={() => togglePlayerSheet()}
            aria-label={sheetOpen ? '收起播放器' : '展开播放器'}
            className="hidden h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--ink)] lg:flex"
          >
            <ChevronUp size={17} strokeWidth={1.75} style={{ transform: sheetOpen ? 'rotate(180deg)' : undefined }} />
          </button>
          <button
            type="button"
            onClick={() => toggleComments()}
            aria-label={`查看评论（${formatCount(currentEpisode.commentCount ?? 0)} 条）`}
            aria-expanded={commentsOpen}
            className="flex h-9 items-center gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)]"
          >
            <MessageCircle size={17} strokeWidth={1.75} />
            <span className="type-value tabnum">{formatCount(currentEpisode.commentCount ?? 0)}</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
