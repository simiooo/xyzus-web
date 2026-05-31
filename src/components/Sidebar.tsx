import { useNavigate, useLocation } from 'react-router'
import { HomeOutlined, AppstoreOutlined, HeartOutlined, UserOutlined, InboxOutlined } from '@ant-design/icons'
import { Avatar, Dropdown } from 'antd'
import useAuthStore from '@/stores/authStore'
import type { MenuProps } from 'antd'

interface NavItem {
  key: string
  icon: React.ComponentType<{ style?: React.CSSProperties }>
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { key: '/', icon: HomeOutlined, label: 'Home' },
  { key: '/categories', icon: AppstoreOutlined, label: 'Categories' },
  { key: '/subscriptions', icon: InboxOutlined, label: 'Subscriptions' },
  { key: '/favorites', icon: HeartOutlined, label: 'Favorites' },
]

function getActiveKey(pathname: string): string {
  if (pathname === '/' || pathname.startsWith('/toplist') || pathname.startsWith('/editor-picks')) return '/'
  if (pathname.startsWith('/categories') || pathname.startsWith('/category')) return '/categories'
  if (pathname.startsWith('/subscriptions')) return '/subscriptions'
  if (pathname.startsWith('/favorites')) return '/favorites'
  return '/'
}

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const activeKey = getActiveKey(location.pathname)

  const userMenuItems: MenuProps['items'] = [
    { key: 'favorites', label: 'My Favorites', onClick: () => navigate('/favorites') },
    { key: 'logout', label: 'Logout', onClick: () => { logout(); navigate('/login') } },
  ]

  return (
    <div className="fixed left-0 top-0 h-screen w-16 bg-sidebar z-40 flex flex-col items-center py-5 border-r border-subtle">
      {/* Logo */}
      <div
        className="w-10 h-10 rounded-full bg-accent-primary flex items-center justify-center cursor-pointer mb-8 shadow-sm"
        onClick={() => navigate('/')}
      >
        <span className="text-white text-sm font-bold">P</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col items-center gap-2 flex-1 w-full px-2">
        {NAV_ITEMS.map(({ key, icon: Icon, label }) => {
          const isActive = activeKey === key
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              className="w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 border-0"
              style={{
                background: isActive ? '#FF7A45' : 'transparent',
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.40)',
                boxShadow: isActive ? '0 4px 12px rgba(255,122,69,0.25)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.75)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.40)'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
              title={label}
            >
              <Icon style={{ fontSize: 22 }} />
            </button>
          )
        })}
      </nav>

      {/* User Avatar */}
      <div className="mb-2">
        <Dropdown menu={{ items: userMenuItems }} placement="topRight">
          {user?.avatar?.picture?.thumbnailUrl ? (
            <Avatar
              src={user.avatar.picture.thumbnailUrl}
              size={36}
              className="cursor-pointer"
              style={{ border: '2px solid rgba(255,255,255,0.15)' }}
            />
          ) : (
            <Avatar icon={<UserOutlined />} size={36} className="cursor-pointer" style={{ background: '#352C26' }} />
          )}
        </Dropdown>
      </div>
    </div>
  )
}
