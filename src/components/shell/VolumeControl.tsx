import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import useAudioStore from '@/stores/audioStore'
import Seekbar from '@/components/ui/Seekbar'

/**
 * 音量：不是高频操作，收进一个轻量 popover（播放条上一个喇叭按钮）。
 * 浮层贴着按钮上方出现，白底、细边、轻阴影，里面只有「静音 + 滑杆 + 百分比」。
 */
export default function VolumeControl({ className = '' }: { className?: string }) {
  const volume = useAudioStore((s) => s.volume)
  const setVolume = useAudioStore((s) => s.setVolume)
  const muted = volume === 0

  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // 点浮层外面 / 按 Esc 关闭
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={muted ? '取消静音' : '音量'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)]"
      >
        {muted ? <VolumeX size={17} strokeWidth={1.75} /> : <Volume2 size={17} strokeWidth={1.75} />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="音量"
          className="absolute bottom-[calc(100%+40px)] right-0 z-50 flex w-[224px] items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-float"
        >
          <button
            type="button"
            onClick={() => setVolume(muted ? 0.6 : 0)}
            aria-label={muted ? '取消静音' : '静音'}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)]"
          >
            {muted ? <VolumeX size={16} strokeWidth={1.75} /> : <Volume2 size={16} strokeWidth={1.75} />}
          </button>

          <Seekbar
            value={volume}
            max={1}
            step={0.05}
            size="sm"
            tone="ink"
            label="音量"
            onChange={(v) => setVolume(v)}
            className="flex-1"
          />

          <span className="w-8 flex-shrink-0 text-right type-meta tabnum">{Math.round(volume * 100)}</span>
        </div>
      )}
    </div>
  )
}
