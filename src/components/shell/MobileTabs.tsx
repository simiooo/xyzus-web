import { useNavigate, useLocation } from 'react-router'
import { MOBILE_TABS, isNavActive } from './nav'

/** 移动端底栏：四个入口，选中项墨色 600（字重本身表示状态） */
export default function MobileTabs() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--background)] lg:hidden"
      aria-label="主导航"
    >
      <div className="flex h-[var(--tabbar-h)] items-stretch safe-bottom">
        {MOBILE_TABS.map((item) => {
          const active = isNavActive(item, location.pathname)
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.href)}
              aria-current={active ? 'page' : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent transition-colors"
              style={{ color: active ? 'var(--ink)' : 'var(--muted-foreground)' }}
            >
              <Icon size={22} strokeWidth={1.75} style={{ color: active ? 'var(--ink)' : 'var(--faint)' }} />
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 400 }}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
