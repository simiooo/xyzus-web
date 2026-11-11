import { currentAccountId, db, entityKey, pageKey } from './schema'

/**
 * Phase 1：实体 / 分页缓存 + stale-while-revalidate。
 *
 * 策略：
 * - 读：先返回缓存（页面立刻有内容），调用方再判断 `isFresh` 决定是否后台刷新；
 * - 写：网络成功后覆盖缓存；
 * - 失效：用户写操作后按 scope 定向失效（宁多勿错，TTL 兜底）。
 */

export const CACHE_TTL = {
  episodeDetail: 24 * 60 * 60 * 1000,
  podcastDetail: 12 * 60 * 60 * 1000,
  homeFeatured: 5 * 60 * 1000,
  homeDiscovery: 3 * 60 * 1000,
  homeCategory: 10 * 60 * 1000,
  subscriptionList: 5 * 60 * 1000,
  podcastRelated: 12 * 60 * 60 * 1000,
  episodeList: 10 * 60 * 1000,
} as const

export interface CachedValue<T> {
  data: T
  fetchedAt: number
}

export interface CachedPageValue<T> {
  payload: T
  loadMoreKey?: unknown
  fetchedAt: number
}

export function isFresh(fetchedAt: number, ttl: number): boolean {
  return Date.now() - fetchedAt < ttl
}

export async function readEntity<T>(type: string, id: string): Promise<CachedValue<T> | null> {
  try {
    const row = await db.entities.get(entityKey(currentAccountId(), type, id))
    if (!row) return null
    return { data: row.data as T, fetchedAt: row.fetchedAt }
  } catch {
    return null
  }
}

export async function writeEntity(type: string, id: string, data: unknown): Promise<void> {
  const account = currentAccountId()
  try {
    await db.entities.put({
      key: entityKey(account, type, id),
      account,
      type,
      id,
      data,
      fetchedAt: Date.now(),
    })
  } catch {
    // 缓存失败不影响主流程
  }
}

export async function readPage<T>(scope: string, variant = ''): Promise<CachedPageValue<T> | null> {
  try {
    const row = await db.pages.get(pageKey(currentAccountId(), scope, variant))
    if (!row) return null
    return { payload: row.payload as T, loadMoreKey: row.loadMoreKey, fetchedAt: row.fetchedAt }
  } catch {
    return null
  }
}

export async function writePage(
  scope: string,
  variant: string,
  payload: unknown,
  loadMoreKey?: unknown,
): Promise<void> {
  const account = currentAccountId()
  try {
    await db.pages.put({
      key: pageKey(account, scope, variant),
      account,
      scope,
      variant,
      payload,
      ...(loadMoreKey === undefined ? {} : { loadMoreKey }),
      fetchedAt: Date.now(),
    })
  } catch {
    // ignore
  }
}

export async function invalidatePage(scope: string, variant = ''): Promise<void> {
  try {
    await db.pages.delete(pageKey(currentAccountId(), scope, variant))
  } catch {
    // ignore
  }
}

export async function invalidateScope(scope: string): Promise<void> {
  try {
    const account = currentAccountId()
    await db.pages.filter((row) => row.account === account && row.scope === scope).delete()
  } catch {
    // ignore
  }
}

/** 启动时轻量清理：删除 30 天未刷新（按 fetchedAt 写入时间）的实体/页面，避免 IndexedDB 无界增长 */
export async function pruneStaleCache(maxAgeMs = 30 * 24 * 60 * 60 * 1000): Promise<void> {
  const threshold = Date.now() - maxAgeMs
  try {
    await db.entities.where('fetchedAt').below(threshold).delete()
    await db.pages.where('fetchedAt').below(threshold).delete()
  } catch {
    // ignore
  }
}
