import { Bell, Compass, Heart, Inbox, LayoutGrid, Trophy, type LucideIcon } from 'lucide-react'

export interface NavItem {
  key: string
  label: string
  href: string
  icon: LucideIcon
  /** 路由前缀匹配：这些前缀都算选中 */
  match: string[]
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'discover', label: '发现', href: '/', icon: Compass, match: ['/', '/toplist', '/editor-picks'] },
  { key: 'chart', label: '榜单', href: '/toplist/HOT', icon: Trophy, match: ['/toplist'] },
  { key: 'category', label: '分类', href: '/categories', icon: LayoutGrid, match: ['/categories', '/category'] },
  { key: 'subscription', label: '订阅', href: '/subscriptions', icon: Inbox, match: ['/subscriptions'] },
  { key: 'inbox', label: '消息', href: '/inbox', icon: Bell, match: ['/inbox'] },
  { key: 'favorite', label: '收藏', href: '/favorites', icon: Heart, match: ['/favorites'] },
]

/** 移动端底栏：四项，去掉「榜单」（榜单从发现页进入）和「消息」（顶栏铃铛进入） */
export const MOBILE_TABS: NavItem[] = NAV_ITEMS.filter(
  (item) => item.key !== 'chart' && item.key !== 'inbox',
)

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.key === 'discover') {
    return pathname === '/' || pathname.startsWith('/editor-picks') || pathname.startsWith('/episode')
  }
  if (item.key === 'chart') {
    return pathname.startsWith('/toplist')
  }
  if (item.key === 'category') {
    return pathname.startsWith('/categories') || pathname.startsWith('/category')
  }
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
