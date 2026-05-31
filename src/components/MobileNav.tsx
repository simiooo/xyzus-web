import { useNavigate, useLocation } from 'react-router'
import { HomeOutlined, AppstoreOutlined, HeartOutlined } from '@ant-design/icons'

interface NavItem {
  key: string
  icon: React.ComponentType<{ style?: React.CSSProperties }>
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { key: '/', icon: HomeOutlined, label: 'Home' },
  { key: '/categories', icon: AppstoreOutlined, label: 'Categories' },
  { key: '/favorites', icon: HeartOutlined, label: 'Favorites' },
]

function getActiveKey(pathname: string): string {
  if (pathname === '/' || pathname.startsWith('/toplist') || pathname.startsWith('/editor-picks')) return '/'
  if (pathname.startsWith('/categories') || pathname.startsWith('/category')) return '/categories'
  if (pathname.startsWith('/favorites')) return '/favorites'
  return '/'
}

export default function MobileNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const activeKey = getActiveKey(location.pathname)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[41] bg-surface border-t border-subtle">
      <div className="flex items-center justify-around h-14 px-2">
        {NAV_ITEMS.map(({ key, icon: Icon, label }) => {
          const isActive = activeKey === key
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-150 border-0"
              style={{
                background: 'transparent',
                color: isActive ? '#FF7A45' : 'rgba(255,255,255,0.40)',
              }}
            >
              <Icon style={{ fontSize: 22 }} />
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
