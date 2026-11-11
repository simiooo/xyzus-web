import { useState } from 'react'
import { Heart } from 'lucide-react'
import { favoriteEpisodeUpdateAPI } from '@/api/episode'
import type { EpisodeBasic } from '@/api/types'

interface FavoriteButtonProps {
  episode: Pick<EpisodeBasic, 'eid' | 'isFavorited'>
  /** 带文字的版本（单集详情页），否则只有图标 */
  withLabel?: boolean
  className?: string
}

/**
 * 收藏：状态用墨色表示（不是强调色），心形实心 + 文字。
 * 本地状态用「数据源键」区分：接口返回的新状态到了，键变了就自动跟数据源一致。
 */
export default function FavoriteButton({ episode, withLabel = false, className = '' }: FavoriteButtonProps) {
  const sourceKey = `${episode.eid}:${Boolean(episode.isFavorited)}`
  const [override, setOverride] = useState<{ key: string; value: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const favorited = override && override.key === sourceKey ? override.value : Boolean(episode.isFavorited)

  const toggle = async () => {
    if (busy) return
    const next = !favorited
    setBusy(true)
    setOverride({ key: sourceKey, value: next })
    try {
      await favoriteEpisodeUpdateAPI({ eid: episode.eid, favorited: next })
    } catch {
      setOverride({ key: sourceKey, value: !next })
    } finally {
      setBusy(false)
    }
  }

  if (!withLabel) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={favorited}
        aria-label={favorited ? '取消收藏' : '收藏'}
        className={`flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent transition-colors ${
          favorited
            ? 'text-[var(--accent)] hover:bg-[var(--muted)]'
            : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--ink)]'
        } ${className}`}
      >
        {favorited ? <Heart size={16} strokeWidth={1.75} fill="currentColor" /> : <Heart size={16} strokeWidth={1.75} />}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorited}
      className={`${favorited ? 'pill pill-accent' : 'pill pill-ghost'} ${className}`}
      style={favorited ? undefined : { boxShadow: 'inset 0 0 0 1px var(--border)' }}
    >
      {favorited ? <Heart size={14} strokeWidth={1.75} fill="currentColor" /> : <Heart size={14} strokeWidth={1.75} />}
      {favorited ? '已收藏' : '收藏'}
    </button>
  )
}
