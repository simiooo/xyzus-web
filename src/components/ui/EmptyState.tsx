import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}

/**
 * 空状态：左对齐在内容边线上，只有一个线条图形 —— 不用插画和居中卡片。
 * 「还没加载」用骨架，「加载完是空的」用这里。
 */
export default function EmptyState({ title, hint, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`py-14 ${className}`}>
      <EmptyGlyph />
      <p className="mt-4 type-title">{title}</p>
      {hint && <p className="mt-1.5 max-w-[420px] type-sub">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

function EmptyGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <circle cx="17" cy="17" r="15.25" stroke="var(--hairline)" strokeWidth="1.5" />
      <rect x="13" y="12" width="2" height="10" rx="1" fill="var(--hairline)" />
      <rect x="17.5" y="9.5" width="2" height="15" rx="1" fill="var(--hairline)" />
      <rect x="22" y="13" width="2" height="8" rx="1" fill="var(--hairline)" />
    </svg>
  )
}
