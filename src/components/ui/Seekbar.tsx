import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

type SeekbarSize = 'sm' | 'md' | 'lg'
type SeekbarTone = 'accent' | 'ink'

interface SeekbarProps {
  value: number
  max: number
  min?: number
  step?: number
  size?: SeekbarSize
  /** accent：播放进度；ink：音量这类不该抢强调色的滑块 */
  tone?: SeekbarTone
  label: string
  disabled?: boolean
  /** 拖动过程中连续回调 */
  onChange?: (value: number) => void
  /** 松手/键盘操作结束才回调（真正提交跳转用这个） */
  onChangeComplete?: (value: number) => void
  className?: string
}

/**
 * 宽轨道进度条（当前流行的样式）：
 * - 6px 圆角轨道，悬停时加粗到 8px
 * - 填充用强调色，未播放部分用中性灰
 * - 拖动圆点默认隐藏，悬停 / 聚焦 / 拖动 / 触屏时出现
 * 底层是原生 input[type=range]：键盘、读屏、触屏都按原生的来。
 */
export default function Seekbar({
  value,
  max,
  min = 0,
  step = 1,
  size = 'md',
  tone = 'accent',
  label,
  disabled = false,
  onChange,
  onChangeComplete,
  className = '',
}: SeekbarProps) {
  const [draft, setDraft] = useState<number | null>(null)
  const draftRef = useRef<number | null>(null)

  const span = max - min
  const shown = draft ?? value
  const percent = span > 0 ? Math.min(100, Math.max(0, ((shown - min) / span) * 100)) : 0

  const handleInput = (next: number) => {
    draftRef.current = next
    setDraft(next)
    onChange?.(next)
  }

  const commit = () => {
    const next = draftRef.current
    if (next === null) return
    draftRef.current = null
    setDraft(null)
    onChangeComplete?.(next)
  }

  // 松手可能发生在滑块外面：拖动期间监听 window 的 pointerup，保证一定会提交
  useEffect(() => {
    if (draft === null) return
    const onUp = () => commit()
    window.addEventListener('pointerup', onUp, { once: true })
    return () => window.removeEventListener('pointerup', onUp)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commit 只读 ref，不需要重建监听
  }, [draft])

  return (
    <input
      type="range"
      className={`seekbar ${className}`}
      data-size={size}
      data-tone={tone}
      min={min}
      max={Math.max(max, min + 1)}
      step={step}
      value={shown}
      disabled={disabled}
      aria-label={label}
      style={{ '--seek-pct': `${percent}%` } as CSSProperties}
      onInput={(event) => handleInput(Number(event.currentTarget.value))}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
    />
  )
}
