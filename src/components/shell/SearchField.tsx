import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Search } from 'lucide-react'

interface SearchFieldProps {
  className?: string
  /** 移动端收起成图标按钮 */
  compact?: boolean
  autoFocus?: boolean
}

/**
 * 全局搜索框：顶栏里的唯一搜索入口。
 * 在 /search 页面时与 URL 上的 keyword 同步，回车即搜。
 */
export default function SearchField({ className = '', autoFocus = false }: SearchFieldProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const onSearchPage = location.pathname === '/search'
  const urlKeyword = onSearchPage ? searchParams.get('keyword') ?? '' : ''

  // 输入的是草稿；没有草稿时显示 URL 上的关键词（避免 effect 里 setState）
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? urlKeyword
  const inputRef = useRef<HTMLInputElement>(null)

  // 键盘：任何页面按 "/" 聚焦搜索
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (e.key === '/' && !isTyping) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const submit = () => {
    const keyword = value.trim()
    if (!keyword) return
    setDraft(null)
    navigate(`/search?keyword=${encodeURIComponent(keyword)}`)
    inputRef.current?.blur()
  }

  return (
    <div
      className={`flex h-11 items-center gap-2.5 rounded-full bg-[var(--muted)] px-4 transition-colors focus-within:bg-[var(--sunken)] focus-within:shadow-[inset_0_0_0_1px_var(--border)] ${className}`}
    >
      <Search size={18} strokeWidth={1.75} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
      <input
        ref={inputRef}
        type="search"
        value={value}
        autoFocus={autoFocus}
        placeholder="搜索节目、单集、用户"
        aria-label="搜索"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') {
            setDraft('')
            inputRef.current?.blur()
          }
        }}
        className="h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
      />
      {value && (
        <button
          type="button"
          aria-label="清空搜索"
          onClick={() => {
            setDraft('')
            inputRef.current?.focus()
          }}
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[var(--faint)] hover:text-[var(--ink)]"
        >
          ×
        </button>
      )}
    </div>
  )
}
