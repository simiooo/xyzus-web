import { useNavigate } from 'react-router'
import { Bell, Heart, MessageCircle, UserPlus } from 'lucide-react'
import SmartImage from '@/components/ui/SmartImage'
import { describeNotice, type Notice, type NoticeKind } from '@/api/notice'
import { formatRelativeDate } from '@/utils/format'

/** action → 四类图标（未知结构统一用铃铛，不丢行） */
const KIND_ICON: Record<NoticeKind, typeof Heart> = {
  like: Heart,
  reply: MessageCircle,
  follow: UserPlus,
  unknown: Bell,
}

interface NoticeRowProps {
  notice: Notice
}

/**
 * 一行一条互动通知：左边是触发者头像（挖不到头像/昵称时退回该类型的图标），
 * 中间「谁 · 动作」+ 可用的内容摘要（评论正文 / 单集标题），行尾相对时间。
 *
 * 点击行为：source/target 里能安全挖出单集 eid 时整行可点进单集；
 * 挖不到就不可点 —— 不做假按钮，也不因为未知结构报错。
 */
export default function NoticeRow({ notice }: NoticeRowProps) {
  const navigate = useNavigate()
  const view = describeNotice(notice)
  const Icon = KIND_ICON[view.kind]
  const timeText = formatRelativeDate(notice.createdAt)
  const eid = view.eid
  const clickable = Boolean(eid)

  const openEpisode = () => {
    if (eid) navigate(`/episode/${eid}`)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!clickable) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openEpisode()
    }
  }

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${view.actorName}${view.actionText}，查看单集` : undefined}
      onClick={clickable ? openEpisode : undefined}
      onKeyDown={handleKeyDown}
      className={clickable ? 'row row-pressable' : 'row cursor-default hover:bg-transparent'}
      style={{ alignItems: 'center' }}
    >
      <div className="h-10 w-10 flex-shrink-0">
        {view.actorAvatar ? (
          <SmartImage
            image={view.actorAvatar}
            aspectRatio={1}
            rounded="full"
            className="h-10 w-10"
            alt=""
          />
        ) : (
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]"
            aria-hidden
          >
            <Icon size={18} strokeWidth={1.75} />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="m-0 type-manage text-[var(--ink)]">
          {view.actorAvatar && (
            <Icon
              size={14}
              strokeWidth={1.75}
              aria-hidden
              className="mr-1.5 inline-block align-[-2px] text-[var(--muted-foreground)]"
            />
          )}
          <span className="font-semibold">{view.actorName}</span>
          <span className="text-[var(--muted-foreground)]"> · {view.actionText}</span>
        </p>

        {view.summary && (
          <p className="m-0 mt-1 line-clamp-2 type-sub">{view.summary}</p>
        )}
      </div>

      {timeText && (
        <span className="flex-shrink-0 self-center whitespace-nowrap type-value">{timeText}</span>
      )}
    </div>
  )
}
