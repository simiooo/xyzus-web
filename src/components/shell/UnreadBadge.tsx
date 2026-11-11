import useNotificationStore from '@/stores/notificationStore'

/**
 * 未读消息徽标：墨色实心 + 白字（强调色只留给播放），数字等宽。
 * 服务端未读数超过本机已读水位时才显示；超过 99 显示 99+。
 */
export default function UnreadBadge({ className = '' }: { className?: string }) {
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const seenCount = useNotificationStore((s) => s.seenCount)

  if (unreadCount <= seenCount || unreadCount <= 0) return null

  return (
    <span
      aria-label={`${unreadCount} 条未读消息`}
      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--ink)] px-1 text-[11px] leading-none tabnum text-[var(--background)] ${className}`}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )
}
