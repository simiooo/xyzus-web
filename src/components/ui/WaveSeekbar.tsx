import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

const BAR_POOL = 120

/** 稳定伪随机（同一个下标 + 种子永远得到同一个值，重渲染时波形不乱跳） */
function hash(index: number, seed: number): number {
  const raw = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453
  return raw - Math.floor(raw)
}

function smoothstep(x: number): number {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

interface BarSpec {
  /** 柱高占比 0–1 */
  amp: number
  opacity: number
}

/**
 * 生成一条「像真实音频」的波形：
 * 低频包络（起伏）+ 少量高频细节（毛刺），并用 smoothstep 在首尾把幅度与透明度
 * 柔和地收下去，避免两端柱子突然归零。
 */
function buildBars(count: number): BarSpec[] {
  return Array.from({ length: count }, (_, index) => {
    const t = count > 1 ? index / (count - 1) : 0
    const envelope =
      0.58 +
      0.2 * Math.sin(t * Math.PI * 2.7 + 1.4) +
      0.12 * Math.sin(t * Math.PI * 6.1 + 0.5) +
      0.08 * Math.sin(t * Math.PI * 11.3 + 2.1)
    const jitter = (hash(index, 1) - 0.5) * 0.2

    // 首尾各 8% 做收尾淡出
    const edge = Math.min(index, count - 1 - index)
    const fade = smoothstep(edge / Math.max(1, count * 0.08))

    return {
      amp: Math.max(0.1, Math.round((envelope + jitter) * (0.16 + 0.84 * fade) * 100) / 100),
      // 只让首尾的柱子变淡（配合遮罩收尾），中间保持干净
      opacity: Math.round((0.3 + 0.7 * fade) * 100) / 100,
    }
  })
}

/**
 * 生成一次就缓存：波形只跟柱子数量有关，不参与每一帧或每一次时间回调的重算。
 */
function barsFor(count: number): BarSpec[] {
  const key = Math.min(count, BAR_POOL)
  return buildBars(key)
}

interface WaveSeekbarProps {
  value: number
  max: number
  playing?: boolean
  disabled?: boolean
  label: string
  /** 柱子数量，按容器宽度调 */
  bars?: number
  size?: 'md' | 'lg'
  tone?: 'accent' | 'ink'
  onChange?: (value: number) => void
  onChangeComplete?: (value: number) => void
  className?: string
}

/**
 * 声波进度条：轨道里是实时跳动的柱状声波。
 * - 动画全部在 CSS：柱高固定，播放时只做 `transform: scaleY` 的错峰动画，
 *   由合成器处理，不触发 layout / paint，也不产生每帧 React 更新；
 * - 每根柱子有自己的动画时长/延迟，避免整齐划一的呼吸感；
 * - React 只在时间回调（约 4Hz）切换「已播 / 未播」的颜色；
 * - 交互层是透明的原生 `input[type=range]`，键盘与读屏保持原生语义。
 */
export default function WaveSeekbar({
  value,
  max,
  playing = false,
  disabled = false,
  label,
  bars = 72,
  size = 'md',
  tone = 'accent',
  onChange,
  onChangeComplete,
  className = '',
}: WaveSeekbarProps) {
  const [draft, setDraft] = useState<number | null>(null)
  const [autoCount, setAutoCount] = useState(bars)
  const rootRef = useRef<HTMLDivElement>(null)

  // 按容器实际宽度决定柱子数量（约每 7px 一根），避免窄容器里柱子挤到溢出、
  // 也避免宽容器里柱子太稀。只在尺寸变化时更新一次，不参与动画帧。
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth
      if (width <= 0) return
      setAutoCount(Math.floor(width / 7))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const count = Math.min(Math.max(Math.min(autoCount, bars), 24), BAR_POOL)
  const specs = useMemo(() => barsFor(count), [count])

  const shown = draft ?? value
  const percent = max > 0 ? Math.min(100, Math.max(0, (shown / max) * 100)) : 0
  const playedCount = Math.round((percent / 100) * count)

  const commit = (next: number) => {
    setDraft(null)
    onChangeComplete?.(next)
  }

  const handleInput = (next: number) => {
    setDraft(next)
    onChange?.(next)
  }

  return (
    <div
      ref={rootRef}
      className={`wave-seekbar ${className}`}
      data-size={size}
      data-tone={tone}
      data-playing={playing && !disabled}
    >
      <div className="wave-seekbar__bars" aria-hidden>
        {specs.map((bar, index) => (
          <span
            key={index}
            className="wave-seekbar__bar"
            data-played={index < playedCount}
            style={
              {
                '--wave-amp': bar.amp,
                '--wave-i': index,
                opacity: bar.opacity,
              } as CSSProperties
            }
          />
        ))}
      </div>
      {percent > 0 && <span className="wave-seekbar__head" style={{ left: `${percent}%` }} aria-hidden />}
      <input
        type="range"
        className="wave-seekbar__input"
        min={0}
        max={Math.max(1, Math.round(max))}
        step={1}
        value={Math.round(shown)}
        disabled={disabled}
        aria-label={label}
        onInput={(event) => handleInput(Number(event.currentTarget.value))}
        onPointerUp={(event) => commit(Number(event.currentTarget.value))}
        onKeyUp={(event) => commit(Number(event.currentTarget.value))}
        onBlur={(event) => commit(Number(event.currentTarget.value))}
      />
    </div>
  )
}
