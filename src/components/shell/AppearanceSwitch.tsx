import { Moon, Sun } from 'lucide-react'
import useThemeStore from '@/stores/themeStore'
import type { Appearance } from '@/theme'

const OPTIONS: { key: Appearance; label: string; Icon: typeof Sun }[] = [
  { key: 'light', label: '日间', Icon: Sun },
  { key: 'dark', label: '夜间', Icon: Moon },
]

/**
 * 外观切换：白&墨（默认）与夜间。和主题色一样是两版，写进 `data-theme`，
 * Ant Design 侧由 `buildTheme(accent, appearance)` 一起换。
 */
export default function AppearanceSwitch({ className = '' }: { className?: string }) {
  const appearance = useThemeStore((s) => s.appearance)
  const setAppearance = useThemeStore((s) => s.setAppearance)

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full bg-[var(--muted)] p-1 ${className}`}
      role="radiogroup"
      aria-label="外观"
    >
      {OPTIONS.map(({ key, label, Icon }) => {
        const selected = appearance === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setAppearance(key)}
            className="flex h-8 w-8 items-center justify-center rounded-full border-0 transition-colors"
            style={{
              background: selected ? 'var(--surface)' : 'transparent',
              color: selected ? 'var(--ink)' : 'var(--faint)',
              boxShadow: selected ? '0 1px 2px rgba(0, 0, 0, 0.10)' : 'none',
            }}
          >
            <Icon size={16} strokeWidth={1.75} />
          </button>
        )
      })}
    </div>
  )
}
