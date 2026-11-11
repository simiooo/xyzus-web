import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { UserPlus } from 'lucide-react'
import { followingUpdatesListAPI, type FollowingUpdate } from '@/api/following'
import { formatRelativeDate } from '@/utils/format'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import SmartImage from '@/components/ui/SmartImage'
import EpisodeRow from '@/components/rows/EpisodeRow'
import { EpisodeRowsSkeleton } from '@/components/ui/Skeleton'

/**
 * 关注动态列表：你关注的听友推荐了哪一期。只读，点单集继续播放/进详情。
 * 数据来自 /following_updates_list（真实抓包是 POST body {}）。
 *
 * 同时给两个入口复用：
 * - `/following` 独立页（默认带页头）
 * - 发现页「关注」tab（`embedded`，不带页头、不显示跳走空态按钮）
 */
export default function FollowingFeed({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const [updates, setUpdates] = useState<FollowingUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      setLoading(true)
      setError(false)
      followingUpdatesListAPI()
        .then((result) => {
          if (cancelled) return
          setUpdates(result.items)
          setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setUpdates([])
          setError(true)
          setLoading(false)
        })
    }
    // 不在 effect 体内同步 setState（react-hooks/set-state-in-effect）：推一个微任务再开始加载
    void Promise.resolve().then(load)
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const visible = updates.filter((update) => Boolean(update.item?.episode))

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="关注动态"
          aside={loading || error ? undefined : `${visible.length} 条`}
          description="你关注的听友推荐的单集都在这里。"
        />
      )}

      {loading ? (
        <EpisodeRowsSkeleton count={4} />
      ) : error ? (
        <div className="py-10">
          <p className="m-0 type-title text-[var(--ink)]">没能加载出来</p>
          <p className="m-0 mt-1.5 max-w-[420px] type-sub">关注动态没能取回来，可能是网络或服务暂时不可用。</p>
          <button type="button" onClick={() => setReloadToken((token) => token + 1)} className="pill pill-ink mt-4">
            重试
          </button>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="还没有关注动态"
          hint="关注喜欢的听友后，他们的推荐会出现在这里。"
          action={
            embedded ? undefined : (
              <button type="button" className="pill pill-ink" onClick={() => navigate('/')}>
                <UserPlus size={16} strokeWidth={1.75} />
                去发现
              </button>
            )
          }
        />
      ) : (
        <div>
          {visible.map((update, index) => (
            <UpdateRow key={update.id} update={update} divided={index > 0} />
          ))}
        </div>
      )}
    </div>
  )
}

function UpdateRow({ update, divided }: { update: FollowingUpdate; divided: boolean }) {
  const item = update.item
  const episode = item?.episode
  if (!episode) return null

  const user = item?.user
  const story = item?.story?.text

  return (
    <div className={divided ? 'dotted-top' : undefined}>
      <div className="pt-4">
        <div className="flex items-center gap-2.5">
          <SmartImage
            image={user?.avatar?.picture}
            aspectRatio={1}
            rounded="full"
            className="h-7 w-7 flex-shrink-0"
            alt={user?.nickname || '听友头像'}
          />
          <p className="m-0 min-w-0 flex-1 truncate type-manage">
            <span className="text-[var(--ink)]">{user?.nickname || '一位听友'}</span>
            <span className="ml-1 type-meta">推荐了这期</span>
          </p>
          {item?.pickedAt && <span className="flex-shrink-0 type-meta">{formatRelativeDate(item.pickedAt)}</span>}
        </div>

        {story && <p className="m-0 mt-2 line-clamp-2 pl-[38px] type-sub">“{story}”</p>}

        <div className="mt-1">
          <EpisodeRow episode={episode} showPodcast />
        </div>
      </div>
    </div>
  )
}
