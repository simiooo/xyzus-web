import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  /** 标题旁的小字：与标题同一基线 */
  aside?: ReactNode
  /** 结束边的操作 */
  actions?: ReactNode
  /** 标题下的一行说明 */
  description?: string
  /** 显示返回按钮 */
  back?: boolean
  size?: 'display' | 'headline'
  className?: string
}

/**
 * 页面标题行。所有页面的标题都从内容起始边开始，
 * 扫码式的小字和按钮与标题同基线（或整体居中，避免高低不一）。
 */
export default function PageHeader({
  title,
  aside,
  actions,
  description,
  back = false,
  size = 'headline',
  className = '',
}: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className={`mb-7 ${className}`}>
      {back && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 -ml-2 inline-flex h-8 items-center gap-1.5 rounded-full px-2 type-sub text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)]"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          返回
        </button>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1
            className={`m-0 text-[var(--ink)] ${size === 'display' ? 'type-display' : 'type-headline'}`}
          >
            {title}
          </h1>
          {aside && <span className="type-aside">{aside}</span>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {description && <p className="m-0 mt-2 max-w-[680px] type-sub">{description}</p>}
    </div>
  )
}
