import { Outlet, useNavigate } from 'react-router'
import { Input, Avatar, Dropdown, Typography } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useState } from 'react'
import useAuthStore from '@/stores/authStore'
import useAudioStore from '@/stores/audioStore'
import Sidebar from './Sidebar'
import RightPanel from './RightPanel'
import MiniPlayer from './MiniPlayer'
import MobileNav from './MobileNav'
import type { MenuProps } from 'antd'

const { Text } = Typography

export default function Layout() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [searchValue, setSearchValue] = useState('')
  const currentEpisode = useAudioStore((s) => s.currentEpisode)

  const handleSearch = (value: string) => {
    if (value.trim()) {
      navigate(`/search?keyword=${encodeURIComponent(value.trim())}`)
    }
  }

  const userMenuItems: MenuProps['items'] = [
    { key: 'favorites', label: 'My Favorites', onClick: () => navigate('/favorites') },
    { key: 'logout', label: 'Logout', onClick: () => { logout(); navigate('/login') } },
  ]

  const paddingBottom = currentEpisode ? 136 : 72

  return (
    <div className="min-h-screen bg-base">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="md:ml-[88px] xl:mr-[324px] min-h-screen transition-all duration-200">
        <div className="sticky top-0 z-sticky bg-base/80 backdrop-blur-md border-b border-subtle">
          <div className="mx-auto max-w-[760px] px-4 md:px-0 h-14 flex items-center gap-3">
            <Text strong className="md:!hidden !text-primary text-lg whitespace-nowrap flex-shrink-0">
              Podcast
            </Text>
            <Input.Search
              placeholder="Search podcasts & episodes"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onSearch={handleSearch}
              className="flex-1 max-w-md"
              size="middle"
            />
            <div className="flex-1 hidden md:block" />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              {user?.avatar?.picture?.thumbnailUrl ? (
                <Avatar
                  src={user.avatar.picture.thumbnailUrl}
                  size={32}
                  className="cursor-pointer flex-shrink-0"
                  style={{ border: '2px solid rgba(255,255,255,0.20)' }}
                />
              ) : (
                <Avatar
                  icon={<UserOutlined />}
                  size={32}
                  className="cursor-pointer flex-shrink-0"
                  style={{ background: '#352C26' }}
                />
              )}
            </Dropdown>
          </div>
        </div>

        <div
          className="mx-auto max-w-[760px] px-4 md:px-0 py-4"
          style={{ paddingBottom }}
        >
          <Outlet />
        </div>
      </div>

      <div className="hidden xl:block">
        <RightPanel />
      </div>

      <MiniPlayer />

      <div className="block md:hidden">
        <MobileNav />
      </div>
    </div>
  )
}
