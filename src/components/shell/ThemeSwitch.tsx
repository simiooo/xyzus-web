import useThemeStore from '@/stores/themeStore'
import { ACCENTS, ACCENT_LABELS, ACCENT_SWATCH, type AccentName } from '@/theme'

interface ThemeSwitchProps {
  /** 紧凑模式：只给两个色点 */
  compact?: boolean
  className?: string
}

/**
 * 主题色切换：蓝 / 粉两版。强调色只影响播放控件这类需要被强调的地方，
 * 底子始终是白与墨。
 */
export default function ThemeSwitch({ compact = false, className = '' }: ThemeSwitchProps) {
  const accent = useThemeStore((s) => s.accent)
  const appearance = useThemeStore((s) => s.appearance)
  const setAccent = useThemeStore((s) => s.setAccent)

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role="radiogroup"
      aria-label="主题强调色"
    >
      {compact && <span className="mr-1 type-meta">主题色</span>}
      {ACCENTS.map((name: AccentName) => {
        const selected = accent === name
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={ACCENT_LABELS[name]}
            title={ACCENT_LABELS[name]}
            onClick={() => setAccent(name)}
            className="flex h-7 w-7 items-center justify-center rounded-full border-0 bg-transparent cursor-pointer transition-transform hover:scale-105"
          >
            <span
              className="block h-[15px] w-[15px] rounded-full transition-all"
              style={{
                background: ACCENT_SWATCH[appearance][name],
                boxShadow: selected
                  ? '0 0 0 2px var(--surface), 0 0 0 3.5px var(--ink)'
                  : '0 0 0 1px var(--border)',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
