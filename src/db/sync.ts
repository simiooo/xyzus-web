import { episodePlayedCacheAPI, type PlayedHistoryItem } from '@/api/playback'
import {
  currentAccountId,
  db,
  getSyncMeta,
  playedCacheVersionKey,
  type PlayedCacheRecord,
} from './schema'

/**
 * 最近收听增量同步（对齐 App 3.4.2 的 list-for-cache 版本游标机制）。
 *
 * App 侧（反编译 EpiHistoryModelImpl）是「带版本的全量快照替换」：
 * 服务端返回当前最近收听快照 + version，needRefresh=true 时 replaceHistoryCache 整体替换、
 * 删掉旧版本行并推进 history_cache_version；needRefresh=false 表示本地缓存仍是最新，不必重拉。
 * 这里用 Dexie 复刻同一语义：本地库 + syncMeta 游标，版本没变就跳过，变了才整体替换。
 *
 * 缓存是加速层不是真相源：未登录/离线/接口失败都静默降级，不打扰主流程。
 */

const SYNC_INTERVAL_MS = 5 * 60 * 1000
/** 快照分页上限，防御异常 loadMoreKey 造成死循环 */
const MAX_PAGES = 20

let syncing = false

/** 读取本地最近收听库（按服务端快照顺序）。供后续 UI / 播放恢复消费。 */
export async function readPlayedCache(): Promise<PlayedHistoryItem[]> {
  const account = currentAccountId()
  try {
    const rows = await db.playedCache.where('account').equals(account).sortBy('position')
    return rows.map((row) => row.data as PlayedHistoryItem)
  } catch {
    return []
  }
}

/** 整体替换某账号的最近收听快照，并在同一事务里推进版本游标。 */
async function replacePlayedCache(
  account: string,
  items: PlayedHistoryItem[],
  version: string,
): Promise<void> {
  const now = Date.now()
  const rows: PlayedCacheRecord[] = items
    .filter((item) => item && typeof item.id === 'string' && item.id.length > 0)
    .map((item, position) => ({
      key: `${account}|${item.id}`,
      account,
      id: item.id,
      version,
      data: item,
      position,
      syncedAt: now,
    }))

  await db.transaction('rw', db.playedCache, db.syncMeta, async () => {
    await db.playedCache.where('account').equals(account).delete()
    if (rows.length > 0) await db.playedCache.bulkPut(rows)
    await db.syncMeta.put({ key: playedCacheVersionKey(account), value: version, updatedAt: now })
  })
}

/** 跑一次增量同步；并发去重，失败静默（下次启动/可见/定时再试）。 */
export async function syncPlayedCache(): Promise<void> {
  if (syncing || typeof window === 'undefined') return
  const account = currentAccountId()
  if (account === 'anonymous') return
  syncing = true
  try {
    const storedVersion = await getSyncMeta<string>(playedCacheVersionKey(account))
    const first = await episodePlayedCacheAPI(storedVersion ?? undefined)

    // 首次无游标必须建库；之后只在服务端告知 needRefresh 时才替换。
    if (!first.needRefresh && storedVersion != null) return

    // 刷新：跟随 loadMoreKey 累积成完整快照（沿用同一 version 游标）。
    let items = [...first.items]
    let version = first.version
    let loadMoreKey = first.loadMoreKey
    for (let page = 0; page < MAX_PAGES && loadMoreKey != null; page += 1) {
      const next = await episodePlayedCacheAPI(version, loadMoreKey)
      items = items.concat(next.items)
      version = next.version ?? version
      loadMoreKey = next.loadMoreKey
    }

    // 服务端没给版本就无法推进游标，保留旧缓存等下次对账。
    if (!version) return
    await replacePlayedCache(account, items, version)
  } catch {
    // 静默降级
  } finally {
    syncing = false
  }
}

/** App 启动挂一次：首次同步 + 定时 + 页面可见 / 网络恢复时同步。 */
export function startPlayedCacheSync(): () => void {
  if (typeof window === 'undefined') return () => {}
  const timer = window.setInterval(() => void syncPlayedCache(), SYNC_INTERVAL_MS)
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncPlayedCache()
  }
  const onOnline = () => void syncPlayedCache()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  void syncPlayedCache()
  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
  }
}