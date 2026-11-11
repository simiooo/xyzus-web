import type { ReactNode } from 'react'

interface SectionHeadProps {
  title: string
  /** 标题旁边的小字（条数等）：与标题同一基线 */
  aside?: string
  /** 结束边的文字按钮 */
  action?: ReactNode
  className?: string
  level?: 'headline' | 'title' | 'section'
}

const TITLE_CLASS: Record<NonNullable<SectionHeadProps['level']>, string> = {
  headline: 'type-headline',
  title: 'type-title',
  section: 'type-section',
}

/**
 * 板块标题行：标题与旁边的小字站在同一条基线上，操作挂在结束边。
 * 一条边线原则：标题始终从内容的起始边开始。
 */
export default function SectionHead({
  title,
  aside,
  action,
  className = '',
  level = 'title',
}: SectionHeadProps) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 ${className}`}>
      <div className="flex items-baseline gap-2.5 min-w-0">
        <h2 className={`${TITLE_CLASS[level]} m-0 text-[var(--ink)]`}>{title}</h2>
        {aside && <span className="type-aside">{aside}</span>}
      </div>
      {action && <div className="flex items-center gap-1 -my-1">{action}</div>}
    </div>
  )
}
