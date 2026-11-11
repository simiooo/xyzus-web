import { playbackProgressUpdateAPI } from '@/api/playback'
import { starSubscriptionUpdateAPI, subscriptionUpdateAPI } from '@/api/subscription'
import { invalidatePage, invalidateScope } from './cache'
import { currentAccountId, db, type OutboxKind, type OutboxRecord } from './schema'

/**
 * Phase 2：写队列（outbox）+ 节流合并。
 * - 所有写操作先落 IndexedDB，再按「同实体最新一条」合并后串行提交；
 * - 失败指数退避，页面关闭也不丢（下次启动继续）；
 * - 播放进度天然 latest-wins；星标/订阅是幂等操作，重复提交无副作用。
 */

export interface PlaybackProgressPayload {
  eid: string
  pid?: string
  playedAt: string
  progress: number
}

export interface StarPayload {
  pid: string
  withStar: boolean
}

export interface SubscriptionPayload {
  pid: string
  mode: 'ON' | 'OFF'
}

interface PayloadByKind {
  playback_progress: PlaybackProgressPayload
  star_subscription: StarPayload
  subscription_update: SubscriptionPayload
}

const FLUSH_DELAY_MS = 700
const MAX_ATTEMPTS = 8
const BATCH_LIMIT = 20

let flushing = false
let scheduledTimer: number | null = null

function backoffMs(attempts: number): number {
  return Math.min(5 * 60_000, 1000 * 2 ** attempts)
}

/** 入队（同一 key 覆盖为最新），IndexedDB 失败会抛错，调用方可决定是否回滚 UI */
export async function enqueueOutbox<K extends OutboxKind>(
  kind: K,
  payload: PayloadByKind[K],
  coalesceId: string,
): Promise<void> {
  const account = currentAccountId()
  const key = `${account}|${kind}|${coalesceId}`
  // delete + add 放同一事务，避免异步间隙里并发入队产生重复 key
  await db.transaction('rw', db.outbox, async () => {
    await db.outbox.where('key').equals(key).delete()
    await db.outbox.add({
      key,
      account,
      kind,
      payload,
      createdAt: Date.now(),
      attempts: 0,
      nextAt: 0,
    })
  })
  scheduleFlush()
}

function scheduleFlush(delay = FLUSH_DELAY_MS): void {
  if (typeof window === 'undefined' || scheduledTimer !== null) return
  scheduledTimer = window.setTimeout(() => {
    scheduledTimer = null
    void flushOutbox()
  }, delay)
}

async function reschedule(rows: OutboxRecord[]): Promise<void> {
  for (const row of rows) {
    if (row.id == null) continue
    const attempts = row.attempts + 1
    // 超过上限后拉长到固定 5min，等下次启动/网络恢复，不再密集重试
    const delay = attempts >= MAX_ATTEMPTS ? 5 * 60_000 : backoffMs(attempts)
    await db.outbox.update(row.id, { attempts, nextAt: Date.now() + delay })
  }
}

async function dispatchSingle(row: OutboxRecord): Promise<void> {
  switch (row.kind) {
    case 'star_subscription': {
      const payload = row.payload as StarPayload
      await starSubscriptionUpdateAPI(payload.pid, payload.withStar)
      await invalidateScope('subscriptionList')
      break
    }
    case 'subscription_update': {
      const payload = row.payload as SubscriptionPayload
      await subscriptionUpdateAPI(payload.pid, payload.mode)
      await invalidateScope('subscriptionList')
      await invalidatePage('podcastDetail', payload.pid)
      break
    }
    case 'playback_progress':
      // 由 flushOutbox 批量合并处理
      break
  }
}

export async function flushOutbox(): Promise<void> {
  if (flushing || typeof window === 'undefined') return
  flushing = true
  try {
    for (let round = 0; round < 8; round += 1) {
      const rows = await db.outbox.where('nextAt').belowOrEqual(Date.now()).limit(BATCH_LIMIT).toArray()
      if (rows.length === 0) break
      let progressed = 0

      const progressRows = rows.filter((row) => row.kind === 'playback_progress')
      if (progressRows.length > 0) {
        const latest = new Map<string, PlaybackProgressPayload>()
        for (const row of progressRows) {
          const payload = row.payload as PlaybackProgressPayload
          latest.set(payload.eid, payload)
        }
        try {
          await playbackProgressUpdateAPI([...latest.values()])
          await db.outbox.bulkDelete(progressRows.map((row) => row.id!))
          progressed += progressRows.length
        } catch {
          await reschedule(progressRows)
        }
      }

      const singles = rows.filter((row) => row.kind !== 'playback_progress')
      for (const row of singles) {
        try {
          await dispatchSingle(row)
          await db.outbox.delete(row.id!)
          progressed += 1
        } catch {
          await reschedule([row])
        }
      }

      if (progressed === 0) break
    }
  } finally {
    flushing = false
  }
}

/** App 启动时挂一次：定时重试 + 可见/离开时兜底 flush */
export function startOutboxAutoFlush(): () => void {
  if (typeof window === 'undefined') return () => {}
  const timer = window.setInterval(() => {
    void flushOutbox()
  }, 15_000)
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void flushOutbox()
  }
  const onPageHide = () => {
    void flushOutbox()
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  void flushOutbox()
  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
  }
}

export async function pendingOutboxCount(): Promise<number> {
  try {
    return await db.outbox.count()
  } catch {
    return 0
  }
}
