import type { MouseEvent } from 'react'

type PlayButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type PlayButtonVariant = 'accent' | 'ink' | 'bare' | 'outline'

interface PlayButtonProps {
  playing?: boolean
  loading?: boolean
  size?: PlayButtonSize
  variant?: PlayButtonVariant
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  label?: string
  className?: string
  disabled?: boolean
}

const SIZE: Record<PlayButtonSize, { box: number; icon: number }> = {
  xs: { box: 28, icon: 14 },
  sm: { box: 36, icon: 17 },
  md: { box: 48, icon: 23 },
  lg: { box: 64, icon: 30 },
  xl: { box: 80, icon: 36 },
}

/**
 * 圆角三角：三个角都做了大半径的圆角（顶点最圆），
 * 纯 fill 绘制、不描边，避免缩放后出现锐利的尖角。
 */
function PlayGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8.2 7.8 L8.2 16.2 Q8.2 18.8 10.41 17.43 L15.97 14 Q19.2 12 15.97 10 L10.41 6.57 Q8.2 5.2 8.2 7.8 Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** 圆角暂停条 */
function PauseGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="7" y="6" width="4" height="12" rx="2" fill="currentColor" />
      <rect x="13" y="6" width="4" height="12" rx="2" fill="currentColor" />
    </svg>
  )
}

function LoadingGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray="34 16"
      />
    </svg>
  )
}

/**
 * 播放控件。强调色只出现在「真的在放/这就是主播放按钮」的地方：
 * - accent：实心强调色圆（播放器主按钮、封面上的播放、正在播放的行）
 * - ink：墨色实心圆（不需要强调时）
 * - outline：描边圆（列表行里的次要入口，悬停才显形）
 * - bare：只有图形，悬停才出现底色
 */
export default function PlayButton({
  playing = false,
  loading = false,
  size = 'md',
  variant = 'accent',
  onClick,
  label,
  className = '',
  disabled = false,
}: PlayButtonProps) {
  const s = SIZE[size]
  const boxClass =
    'inline-flex items-center justify-center rounded-full transition-all duration-150 ease-smooth'

  const variantClass =
    variant === 'accent'
      ? 'bg-[var(--accent)] text-[var(--accent-on-accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]'
      : variant === 'ink'
        ? 'bg-[var(--ink)] text-white hover:bg-black'
        : variant === 'outline'
          ? 'bg-transparent text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--hairline)] hover:bg-[var(--sunken)]'
          : 'bg-transparent text-[var(--ink)] hover:bg-[var(--muted)]'

  return (
    <button
      type="button"
      aria-label={label ?? (playing ? '暂停' : '播放')}
      aria-pressed={playing}
      onClick={onClick}
      disabled={disabled}
      className={`${boxClass} ${variantClass} ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${className}`}
      style={{ width: s.box, height: s.box, flex: '0 0 auto' }}
    >
      {loading ? (
        <LoadingGlyph size={s.icon} />
      ) : playing ? (
        <PauseGlyph size={s.icon} />
      ) : (
        <PlayGlyph size={s.icon} />
      )}
    </button>
  )
}
