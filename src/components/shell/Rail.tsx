import { useNavigate, useLocation } from 'react-router'
import { NAV_ITEMS, isNavActive } from './nav'
import ThemeSwitch from './ThemeSwitch'
import AppearanceSwitch from './AppearanceSwitch'
import BrandLogo from '@/components/ui/BrandLogo'
import AccountMenu from './AccountMenu'
import UnreadBadge from './UnreadBadge'
import useAudioStore from '@/stores/audioStore'

/**
 * 左侧导航栏（≥lg）。行式导航：选中是墨色的 600，不画底、不画图标圆盘。
 */
export default function Rail() {
  const navigate = useNavigate()
  const location = useLocation()
  const hasEpisode = Boolean(useAudioStore((s) => s.currentEpisode))

  return (
    <aside
      className="sticky top-0 z-30 hidden h-screen w-[var(--rail)] flex-shrink-0 flex-col bg-[var(--background)] px-6 pt-4 lg:flex"
    >
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-8 flex h-11 w-11 items-center justify-center rounded-xl border-0 bg-transparent p-0 cursor-pointer transition-transform duration-150 hover:scale-105"
        aria-label="宇宙电台 · 回到发现"
      >
        <BrandLogo size={42} />
      </button>

      <nav className="flex flex-col gap-1" aria-label="主导航">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item, location.pathname)
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.href)}
              aria-current={active ? 'page' : undefined}
              className="-mx-3 flex h-12 items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left transition-colors hover:bg-[var(--sunken)]"
              style={{
                color: active ? 'var(--accent-ink)' : 'var(--muted-foreground)',
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon size={22} strokeWidth={1.75} style={{ color: active ? 'var(--accent-ink)' : 'var(--faint)' }} />
              <span style={{ fontSize: 17 }}>{item.label}</span>
              {/* 消息：未读徽标挂在行尾（墨色实心，强调色只留给播放） */}
              {item.key === 'inbox' && <UnreadBadge className="ml-auto" />}
            </button>
          )
        })}
      </nav>

      <div
        className="mt-auto flex flex-col gap-5"
        style={{ paddingBottom: hasEpisode ? 26 : 32 }}
      >
        <div>
          <p className="m-0 mb-2 type-meta">外观</p>
          <AppearanceSwitch />
        </div>
        <div>
          <p className="m-0 mb-2 type-meta">主题色</p>
          <ThemeSwitch />
        </div>
        {/* 播放条可见时，这条点线与播放条的上边缘同高、铺满左栏宽度，和播放条顶边接成一条线 */}
        <div
          className="dotted-top -mx-6 px-6"
          style={{ paddingTop: hasEpisode ? 26 : 16 }}
        >
          <AccountMenu placement="topLeft" row />
        </div>
      </div>
    </aside>
  )
}
