import Dexie, { type Table } from 'dexie'
import useAuthStore from '@/stores/authStore'

/**
 * 本地缓存库（Phase 1）：实体 + 分页页 + 写队列（Phase 2）。
 * - 按账号隔离（key 前缀 uid），登出/换号不会串数据；
 * - 只缓存「可安全重建」的快照数据，不缓存 token / 音频 / 图片二进制；
 * - 缓存失效策略见 `cache.ts`，写入队列见 `outbox.ts`。
 */

export interface CachedEntity {
  /** `${account}|${type}|${id}` */
  key: string
  account: string
  type: string
  id: string
  data: unknown
  fetchedAt: number
}

export interface CachedPage {
  /** `${account}|${scope}|${variant}` */
  key: string
  account: string
  scope: string
  variant: string
  payload: unknown
  loadMoreKey?: unknown
  fetchedAt: number
}

export type OutboxKind = 'playback_progress' | 'star_subscription' | 'subscription_update'

export interface OutboxRecord {
  id?: number
  /** 合并键：同账号 + 同 kind + 同实体只保留最新一条 */
  key: string
  account: string
  kind: OutboxKind
  payload: unknown
  createdAt: number
  attempts: number
  /** 下次可尝试时间戳（失败指数退避） */
  nextAt: number
}

export interface SyncMetaRecord {
  key: string
  value: unknown
  updatedAt: number
}

/**
 * 最近收听本地库（增量同步）：一行 = 服务端快照里的一条 PlayedHistory。
 * 整库按账号隔离，并打上所属快照版本 `version`；同步时整体替换 + 推进游标。
 */
export interface PlayedCacheRecord {
  /** `${account}|${id}` */
  key: string
  account: string
  id: string
  /** 该行所属的服务端快照版本（ISO 时间戳） */
  version: string
  data: unknown
  /** 在服务端快照里的顺序（0-based），用于稳定排序 */
  position: number
  syncedAt: number
}

class XyzWebDatabase extends Dexie {
  entities!: Table<CachedEntity, string>
  pages!: Table<CachedPage, string>
  outbox!: Table<OutboxRecord, number>
  syncMeta!: Table<SyncMetaRecord, string>
  playedCache!: Table<PlayedCacheRecord, string>

  constructor() {
    super('xyz-web-db')
    this.version(1).stores({
      entities: '&key, account, type, fetchedAt',
      pages: '&key, account, scope, fetchedAt',
      outbox: '++id, &key, account, kind, nextAt',
      syncMeta: '&key, updatedAt',
    })
    // v2：新增最近收听增量同步本地库（旧库升级时自动建表，保留既有数据）
    this.version(2).stores({
      entities: '&key, account, type, fetchedAt',
      pages: '&key, account, scope, fetchedAt',
      outbox: '++id, &key, account, kind, nextAt',
      syncMeta: '&key, updatedAt',
      playedCache: '&key, account, version, syncedAt',
    })
  }
}

export const db = new XyzWebDatabase()

/** 当前账号命名空间；未登录用 anonymous（登出后不会串到其他账号） */
export function currentAccountId(): string {
  return useAuthStore.getState().user?.uid || 'anonymous'
}

export function entityKey(account: string, type: string, id: string): string {
  return `${account}|${type}|${id}`
}

export function pageKey(account: string, scope: string, variant = ''): string {
  return `${account}|${scope}|${variant}`
}

/** 最近收听增量同步的版本游标 key（syncMeta 表，按账号隔离） */
export function playedCacheVersionKey(account: string): string {
  return `${account}|playedCacheVersion`
}

export async function getSyncMeta<T>(key: string): Promise<T | null> {
  try {
    const row = await db.syncMeta.get(key)
    return row ? (row.value as T) : null
  } catch {
    return null
  }
}

export async function setSyncMeta(key: string, value: unknown): Promise<void> {
  try {
    await db.syncMeta.put({ key, value, updatedAt: Date.now() })
  } catch {
    // 游标写失败不影响主流程，下次同步会重新对账
  }
}

/** 清空某个账号的缓存（换号/退出登录时调用，避免隐私残留） */
export async function clearAccountCache(account: string): Promise<void> {
  try {
    await db.transaction('rw', db.entities, db.pages, db.outbox, db.syncMeta, db.playedCache, async () => {
      await db.entities.where('account').equals(account).delete()
      await db.pages.where('account').equals(account).delete()
      await db.outbox.where('account').equals(account).delete()
      await db.playedCache.where('account').equals(account).delete()
      await db.syncMeta.filter((item) => item.key.startsWith(`${account}|`)).delete()
    })
  } catch {
    // IndexedDB 不可用时静默降级
  }
}
