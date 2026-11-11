import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { RotateCcw, RotateCw, X } from 'lucide-react'
import useAudioStore from '@/stores/audioStore'
import useUiStore from '@/stores/uiStore'
import SmartImage from '@/components/ui/SmartImage'
import PlayButton from '@/components/ui/PlayButton'
import WaveSeekbar from '@/components/ui/WaveSeekbar'
import { formatDurationShort } from '@/utils/format'

const RATES = [0.8, 1, 1.25, 1.5, 2]

/**
 * 展开的播放器：大封面 + 完整走带 + 倍速。
 * 移动端从底部升起，桌面端是右下角的一块面板 —— 不再另做一个常驻侧栏播放器。
 */
export default function PlayerSheet() {
  const navigate = useNavigate()
  const open = useUiStore((s) => s.playerSheetOpen)
  const setOpen = useUiStore((s) => s.setPlayerSheetOpen)

  const currentEpisode = useAudioStore((s) => s.currentEpisode)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const isLoading = useAudioStore((s) => s.isLoading)
  const currentTime = useAudioStore((s) => s.currentTime)
  const duration = useAudioStore((s) => s.duration)
  const playbackRate = useAudioStore((s) => s.playbackRate)
  const togglePlay = useAudioStore((s) => s.togglePlay)
  const seekTo = useAudioStore((s) => s.seekTo)
  const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate)

  // Esc 收起
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, setOpen])

  if (!currentEpisode || !open) return null

  const image = currentEpisode.image ?? currentEpisode.podcast?.image
  const total = duration > 0 ? duration : currentEpisode.duration || 0

  // 挂到 body 上：展开播放器必须盖住常驻播放条和其它 fixed 元素
  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal aria-label="播放器">
      <div
        className="absolute inset-0 animate-fade-in bg-[color-mix(in_srgb,#000_38%,transparent)]"
        onClick={() => setOpen(false)}
      />

      <div className="absolute inset-x-0 bottom-0 max-h-[92vh] animate-sheet-up overflow-y-auto overflow-x-hidden scroll-thin rounded-t-[var(--radius-2xl)] bg-[var(--surface)] pb-6 shadow-sheet lg:inset-x-auto lg:bottom-[calc(var(--player-h)+16px)] lg:right-6 lg:w-[400px] lg:rounded-[var(--radius-xl)] lg:pb-5">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[var(--surface)] px-5 pt-3 pb-1">
          <div className="flex flex-col gap-1">
            <span className="h-1 w-8 rounded-full bg-[var(--hairline)] lg:hidden" aria-hidden />
            <span className="type-meta">正在播放</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="收起播放器"
            className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--ink)]"
          >
            <X size={17} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-5">
          <SmartImage
            image={image}
            aspectRatio={1}
            rounded="lg"
            priority
            className="mx-auto mt-2 w-full max-w-[240px]"
            alt={currentEpisode.title}
          />

          <h3 className="mt-4 mb-0 type-title text-[var(--ink)]">{currentEpisode.title}</h3>
          {currentEpisode.podcast?.title && (
            <button
              type="button"
              onClick={() => {
                if (currentEpisode.podcast?.pid) {
                  navigate(`/podcast/${currentEpisode.podcast.pid}`)
                  setOpen(false)
                }
              }}
              className="mt-1 border-0 bg-transparent p-0 type-sub hover:text-[var(--ink)] cursor-pointer"
            >
              {currentEpisode.podcast.title}
            </button>
          )}

          <div className="mt-6 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => seekTo(currentTime - 15)}
              aria-label="后退 15 秒"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent text-[var(--ink-soft)] hover:bg-[var(--muted)]"
            >
              <RotateCcw size={17} strokeWidth={1.75} />
              <span className="absolute bottom-0.5 right-1 type-meta" style={{ fontSize: 9 }}>
                15
              </span>
            </button>

            <PlayButton size="xl" variant="accent" playing={isPlaying} loading={isLoading} onClick={togglePlay} label={isPlaying ? '暂停' : '播放'} />

            <button
              type="button"
              onClick={() => seekTo(currentTime + 30)}
              aria-label="前进 30 秒"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent text-[var(--ink-soft)] hover:bg-[var(--muted)]"
            >
              <RotateCw size={17} strokeWidth={1.75} />
              <span className="absolute bottom-0.5 left-1 type-meta" style={{ fontSize: 9 }}>
                30
              </span>
            </button>
          </div>

          <div className="mt-4">
            <WaveSeekbar
              value={Math.round(currentTime)}
              max={Math.max(1, Math.round(total))}
              playing={isPlaying}
              size="lg"
              bars={68}
              label="播放进度"
              onChange={(v) => seekTo(v)}
            />
            <div className="mt-1 flex justify-between">
              <span className="type-value tabnum text-[var(--muted-foreground)]">
                {formatDurationShort(currentTime)}
              </span>
              <span className="type-value tabnum">{formatDurationShort(total)}</span>
            </div>
          </div>

          <div className="mt-5">
            <p className="m-0 mb-2 type-section">倍速</p>
            <div className="flex flex-wrap gap-1.5">
              {RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  className="pill"
                  data-selected={Math.abs(playbackRate - rate) < 0.01}
                  onClick={() => setPlaybackRate(rate)}
                >
                  {rate === 1 ? '正常' : `${rate}×`}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              navigate(`/episode/${currentEpisode.eid}`)
              setOpen(false)
            }}
            className="mt-5 w-full rounded-full border border-[var(--border)] bg-transparent py-2.5 type-manage text-[var(--ink)] transition-colors hover:bg-[var(--sunken)] cursor-pointer"
          >
            查看单集详情
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
