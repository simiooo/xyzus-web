import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, Heart, LogOut, MessageSquare, Mic, Settings, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import useAuthStore from '@/stores/authStore'
import { userStatsAPI, type UserStats } from '@/api/user'
import { formatCount, formatDate, formatDuration } from '@/utils/format'
import PageHeader from '@/components/ui/PageHeader'
import SmartImage from '@/components/ui/SmartImage'
import { SkeletonBox } from '@/components/ui/Skeleton'

/**
 * 个人资料（/profile）：只读账号信息 + 收听统计 + 快捷入口 + 退出登录。
 * 资料取自 authStore.user（登录时已拉 /profile）；统计另走 /user_stats。
 * 上游没有改昵称/bio 的接口，故本页只读。
 */
export default function Profile() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const uid = user?.uid
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(Boolean(uid))
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    const load = () => {
      setLoading(true)
      setError(false)
      userStatsAPI(uid)
        .then((data) => {
          if (cancelled) return
          setStats(data)
          setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setStats(null)
          setError(true)
          setLoading(false)
        })
    }
    void Promise.resolve().then(load)
    return () => {
      cancelled = true
    }
  }, [uid, reloadToken])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user) {
    return (
      <div className="max-w-[720px]">
        <PageHeader title="个人资料" back />
        <div className="flex items-start gap-5">
          <SkeletonBox className="h-20 w-20" rounded="full" />
          <div className="flex-1">
            <SkeletonBox className="h-[24px] w-[160px]" rounded="sm" />
            <SkeletonBox className="mt-3 h-[16px] w-full max-w-[420px]" rounded="sm" />
            <SkeletonBox className="mt-2 h-[14px] w-[200px]" rounded="sm" />
          </div>
        </div>
      </div>
    )
  }

  const gender = user.gender === 'MALE' ? '男' : user.gender === 'FEMALE' ? '女' : ''
  const phone = user.phoneNumber
    ? `${user.phoneNumber.areaCode || '+86'} ${user.phoneNumber.mobilePhoneNumber}`
    : ''
  const podcasterShows = (user.certifications ?? [])
    .filter((c) => c.kind === 'PODCASTER')
    .flatMap((c) => c.shows ?? [])

  return (
    <div className="max-w-[720px]">
      <PageHeader title="个人资料" back description="你的账号信息与收听数据。资料由小宇宙账号同步，暂不支持在这里修改。" />

      {/* 头像 + 昵称 + 简介 + 标签 */}
      <div className="flex items-start gap-5">
        {user.avatar?.picture ? (
          <SmartImage
            image={user.avatar.picture}
            aspectRatio={1}
            rounded="full"
            className="h-20 w-20 flex-shrink-0"
            alt={user.nickname}
          />
        ) : (
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-[var(--muted-strong)] type-headline text-[var(--muted-foreground)]">
            {(user.nickname || '我').slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="m-0 type-title text-[var(--ink)]">{user.nickname || '未命名听友'}</h2>
          {user.bio && <p className="m-0 mt-2 type-body-lg text-[var(--ink-soft)]">{user.bio}</p>}
          <p className="m-0 mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 type-meta">
            {user.ipLoc && <span>{user.ipLoc}</span>}
            {gender && (
              <>
                <span aria-hidden>·</span>
                <span>{gender}</span>
              </>
            )}
            {user.industry && (
              <>
                <span aria-hidden>·</span>
                <span>{user.industry}</span>
              </>
            )}
            {user.birthYear && (
              <>
                <span aria-hidden>·</span>
                <span className="num">{user.birthYear} 年生</span>
              </>
            )}
          </p>
          {podcasterShows.length > 0 && (
            <p className="m-0 mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 type-meta text-[var(--muted-foreground)]">
              <Mic size={14} strokeWidth={1.75} className="flex-shrink-0" />
              <span>播客主</span>
              {podcasterShows.map((show) => (
                <span key={show.title} className="text-[var(--ink)]">
                  · {show.title}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      {/* 收听统计 */}
      <div className="dotted-top mt-7 pt-6">
        {loading ? (
          <div className="flex flex-wrap gap-x-12 gap-y-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <SkeletonBox className="h-[24px] w-[56px]" rounded="sm" />
                <SkeletonBox className="mt-2 h-[13px] w-[40px]" rounded="sm" />
              </div>
            ))}
          </div>
        ) : error || !stats ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="m-0 type-sub">收听统计没能取回来。</p>
            <button type="button" className="pill" onClick={() => setReloadToken((t) => t + 1)}>
              重试
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-12 gap-y-5">
            <StatItem value={formatCount(stats.followerCount)} label="粉丝" />
            <StatItem value={formatCount(stats.followingCount)} label="关注" />
            <StatItem value={formatCount(stats.subscriptionCount)} label="订阅" />
            <StatItem value={formatDuration(stats.totalPlayedSeconds) || '0 分钟'} label="收听时长" />
          </div>
        )}
      </div>

      {/* 账号信息 */}
      <section className="mt-9">
        <h3 className="m-0 mb-1 type-section">账号信息</h3>
        <div className="dotted-rows">
          <InfoRow label="UID" value={user.uid} mono />
          <InfoRow label="注册时间" value={formatDate(user.createdAt, { year: true })} />
          <InfoRow label="手机号" value={phone} mono />
        </div>
      </section>

      {/* 快捷入口 */}
      <section className="mt-8">
        <h3 className="m-0 mb-1 type-section">快捷入口</h3>
        <div className="dotted-rows">
          <LinkRow icon={Heart} label="我的收藏" onClick={() => navigate('/favorites')} />
          <LinkRow icon={MessageSquare} label="我的评论" onClick={() => navigate('/my-comments')} />
          <LinkRow icon={Settings} label="我的订阅" onClick={() => navigate('/subscriptions')} />
          <LinkRow icon={Users} label="关注动态" onClick={() => navigate('/following')} />
        </div>
      </section>

      {/* 退出登录 */}
      <div className="dotted-top mt-8 pt-6">
        <button
          type="button"
          onClick={handleLogout}
          className="pill"
          style={{
            background: 'color-mix(in srgb, var(--destructive) 10%, var(--background))',
            color: 'var(--destructive)',
          }}
        >
          <LogOut size={15} strokeWidth={1.75} />
          退出登录
        </button>
        <p className="m-0 mt-2.5 type-sub">退出后会清除本机的登录状态与本地缓存，下次需重新扫码登录。</p>
      </div>
    </div>
  )
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="m-0 type-title num text-[var(--ink)]">{value}</p>
      <p className="m-0 mt-1 type-sub">{label}</p>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="row" style={{ cursor: 'default' }}>
      <span className="w-[88px] flex-shrink-0 type-manage text-[var(--muted-foreground)]">{label}</span>
      <span className={`min-w-0 flex-1 type-manage text-[var(--ink)] ${mono ? 'num' : ''}`}>{value || '—'}</span>
    </div>
  )
}

function LinkRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="row row-pressable w-full">
      <Icon size={17} strokeWidth={1.75} className="flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
      <span className="min-w-0 flex-1 type-manage text-[var(--ink)]">{label}</span>
      <ChevronRight size={16} strokeWidth={1.75} className="flex-shrink-0" style={{ color: 'var(--faint)' }} />
    </button>
  )
}