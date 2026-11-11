import alova from '@/alova'
import { unwrapPage } from '@/api/normalize'
import type { DiscoveryRawSection, PageResult } from '@/api/types'

/**
 * 首页三个 tab 的新版发现流（真实抓包 2026-11-11，小宇宙 App 3.4.2）：
 *
 * - `POST /tab_featured_list`  → 上游 `/v1/tab/featured/list`
 *   body `{loadMoreKey?, returnAll:false, forceRefresh:false}`
 *   响应 `{data:[DISCOVERY_HEADER | EDITOR_PICK | DISCOVERY_COLLECTION …]}`（可能带 loadMoreKey）
 * - `POST /tab_discovery_list` → 上游 `/v1/tab/discovery/list`
 *   body `{loadMoreKey?, returnAll:false, forceRefresh:false}`
 *   响应 `{data:[DISCOVERY_HEADER | DISCOVERY_EPISODE_RECOMMEND_V3 | DISCOVERY_VIDEO_PODCAST | TOP_LIST …], loadMoreKey?}`
 * - `POST /tab_category_list` → 上游 `/v1/tab/category/list`
 *   body `{loadMoreKey?}`
 *   响应 `{data:[EPISODE_CATEGORY_BLOCKS], loadMoreKey?}`
 *
 * 页面只拿 `{items, loadMoreKey?}`；板块内部结构由 Home 页的容错渲染器消化。
 * xyz 侧端点在 `backend-patches/notification-endpoints.patch`（task-3 补齐）。
 */

export type HomeFeedLoadMoreKey = string | Record<string, unknown>

export interface HomeFeedParams {
  loadMoreKey?: HomeFeedLoadMoreKey
}

export type HomeFeedPage = PageResult<DiscoveryRawSection, HomeFeedLoadMoreKey>

function normalizePage(raw: unknown): HomeFeedPage {
  return unwrapPage<DiscoveryRawSection, HomeFeedLoadMoreKey>(raw)
}

export const tabFeaturedListAPI = (params?: HomeFeedParams) =>
  alova
    .Post<unknown>('/tab_featured_list', {
      returnAll: false,
      forceRefresh: false,
      ...(params?.loadMoreKey !== undefined ? { loadMoreKey: params.loadMoreKey } : {}),
    })
    .then(normalizePage)

export const tabDiscoveryListAPI = (params?: HomeFeedParams) =>
  alova
    .Post<unknown>('/tab_discovery_list', {
      returnAll: false,
      forceRefresh: false,
      ...(params?.loadMoreKey !== undefined ? { loadMoreKey: params.loadMoreKey } : {}),
    })
    .then(normalizePage)

export const tabCategoryListAPI = (params?: HomeFeedParams) =>
  alova
    .Post<unknown>('/tab_category_list', {
      ...(params?.loadMoreKey !== undefined ? { loadMoreKey: params.loadMoreKey } : {}),
    })
    .then(normalizePage)
