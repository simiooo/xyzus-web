import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Avatar, Dropdown } from 'antd'
import { Heart, LogOut, MessageSquare, Settings, User, Users } from 'lucide-react'
import type { MenuProps } from 'antd'
import useAuthStore from '@/stores/authStore'
import SmartImage from '@/components/ui/SmartImage'
import ThemeSwitch from './ThemeSwitch'

interface AccountMenuProps {
  compact?: boolean
  className?: string
}

/** 账号入口：头像 + 下拉（收藏、退出登录） */
export default function AccountMenu({ compact = false, className = '' }: AccountMenuProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)

  const items: MenuProps['items'] = [
    {
      key: 'profile',
      label: (
        <div className="flex items-center gap-2.5 py-1 pr-2">
          {user?.avatar?.picture ? (
            <SmartImage
              image={user.avatar.picture}
              aspectRatio={1}
              rounded="full"
              className="h-9 w-9 flex-shrink-0"
              alt={user.nickname}
            />
          ) : (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--muted-strong)]">
              <User size={18} strokeWidth={1.75} style={{ color: 'var(--muted-foreground)' }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="m-0 type-manage line-clamp-1 text-[var(--ink)]">{user?.nickname || '未登录'}</p>
            {user?.ipLoc && <p className="m-0 mt-0.5 type-meta">{user.ipLoc}</p>}
          </div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'favorites',
      icon: <Heart size={16} strokeWidth={1.75} />,
      label: '我的收藏',
      onClick: () => navigate('/favorites'),
    },
    {
      key: 'my-comments',
      icon: <MessageSquare size={16} strokeWidth={1.75} />,
      label: '我的评论',
      onClick: () => navigate('/my-comments'),
    },
    {
      key: 'following',
      icon: <Users size={16} strokeWidth={1.75} />,
      label: '关注动态',
      onClick: () => navigate('/following'),
    },
    {
      key: 'subscriptions',
      icon: <Settings size={16} strokeWidth={1.75} />,
      label: '我的订阅',
      onClick: () => navigate('/subscriptions'),
    },
    { type: 'divider' },
    {
      key: 'theme',
      label: (
        <div className="flex items-center justify-between gap-3 py-1 pr-1">
          <span className="type-manage text-[var(--ink)]">主题色</span>
          <ThemeSwitch />
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogOut size={16} strokeWidth={1.75} />,
      label: '退出登录',
      danger: true,
      onClick: () => {
        logout()
        navigate('/login')
      },
    },
  ]

  const avatarNode = user?.avatar?.picture ? (
    <SmartImage
      image={user.avatar.picture}
      aspectRatio={1}
      rounded="full"
      className={`${compact ? 'h-8 w-8' : 'h-9 w-9'} flex-shrink-0 cursor-pointer`}
      alt={user.nickname}
    />
  ) : (
    <div
      className={`${compact ? 'h-8 w-8' : 'h-9 w-9'} flex flex-shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--muted)] transition-colors hover:bg-[var(--muted-hover)]`}
    >
      <User size={compact ? 15 : 17} strokeWidth={1.75} style={{ color: 'var(--muted-foreground)' }} />
    </div>
  )

  return (
    <Dropdown
      menu={{ items }}
      placement="bottomRight"
      trigger={['click']}
      open={open}
      onOpenChange={setOpen}
    >
      <div className={className} aria-label="账号菜单">
        {avatarNode}
      </div>
    </Dropdown>
  )
}

function AvatarFallback() {
  return <Avatar icon={<User size={16} strokeWidth={1.75} />} />
}

export { AvatarFallback }
