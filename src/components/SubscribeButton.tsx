import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { enqueueOutbox } from '@/db/outbox'
import type { PodcastBasic } from '@/api/types'

interface SubscribeButtonProps {
  podcast: Pick<PodcastBasic, 'pid' | 'subscriptionStatus'>
  onChange?: (subscribed: boolean) => void
  className?: string
}

/**
 * 订阅按钮：订阅是主要动作，用墨色实心胶囊；已订阅是次级状态，用灰胶囊。
 * 强调色不用于订阅 —— 它只留给播放。
 */
export default function SubscribeButton({ podcast, onChange, className = '' }: SubscribeButtonProps) {
  const sourceKey = `${podcast.pid}:${podcast.subscriptionStatus ?? ''}`
  const [override, setOverride] = useState<{ key: string; value: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const subscribed =
    override && override.key === sourceKey
      ? override.value
      : podcast.subscriptionStatus === 'ON'

  const toggle = async () => {
    if (busy) return
    const next = !subscribed
    setBusy(true)
    setOverride({ key: sourceKey, value: next })
    try {
      // 写入落 outbox：本地立即生效，网络失败后台退避重试
      await enqueueOutbox('subscription_update', { pid: podcast.pid, mode: next ? 'ON' : 'OFF' }, podcast.pid)
      onChange?.(next)
    } catch {
      setOverride({ key: sourceKey, value: !next })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={subscribed}
      className={`${subscribed ? 'pill' : 'pill pill-ink'} ${className}`}
    >
      {subscribed ? <Check size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={2} />}
      {subscribed ? '已订阅' : '订阅'}
    </button>
  )
}
