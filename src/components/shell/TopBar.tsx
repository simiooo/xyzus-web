import { useNavigate } from 'react-router'
import { Bell, Search } from 'lucide-react'
import SearchField from './SearchField'
import AccountMenu from './AccountMenu'
import UnreadBadge from './UnreadBadge'
import BrandLogo from '@/components/ui/BrandLogo'

/**
 * 顶栏：桌面端就是一条搜索框加账号；移动端是标题 + 搜索入口。
 * 结构线用实线，顶栏贴着内容边线。
 */
export default function TopBar() {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur-md lg:hidden">
      <div className="flex h-16 w-full items-center gap-3 px-5 lg:px-8 xl:px-10 2xl:px-12">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex h-9 w-9 items-center justify-center rounded-xl border-0 bg-transparent p-0 cursor-pointer transition-transform duration-150 hover:scale-105"
          aria-label="宇宙电台 · 回到发现"
        >
          <BrandLogo size={32} />
        </button>

        <SearchField className="hidden flex-1 sm:flex max-w-[520px]" />

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate('/search')}
            aria-label="搜索"
            className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)] sm:hidden"
          >
            <Search size={17} strokeWidth={1.75} />
          </button>

          {/* 移动端没有「消息」底栏页签，由顶栏铃铛进入 */}
          <button
            type="button"
            onClick={() => navigate('/inbox')}
            aria-label="消息"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)]"
          >
            <Bell size={17} strokeWidth={1.75} />
            <UnreadBadge className="absolute right-0 top-0" />
          </button>

          <AccountMenu compact />
        </div>
      </div>
    </header>
  )
}
