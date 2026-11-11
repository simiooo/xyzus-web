import alova from '@/alova'
import { unwrapItem, unwrapPage, pluckList } from '@/api/normalize'
import type {
  PageResult,
  TopListParams,
  EpisodeBasic,
  EditorPickGroup,
  EditorPickListHistoryParams,
  PilotDiscoveryListParams,
} from '@/api/types'

/**
 * 发现页/榜单/精选接口契约（来源：D:\work\xyz-backend\handlers\discovery.go、top.go、doc\docs\*.md）：
 * - `/top_list`：body `{category:"HOT"|"ROCK"|"NEW"}`（后端映射到上游 HOT_EPISODES_IN_24_HOURS 等）；
 *   上游 body 是 `{data:{items:[{item:<episode>}], title, information, …}}` —— 旧客户端把 items 当单集
 *   直接 `.map` 会崩，这里归一化成 `EpisodeBasic[]`（榜单标题等元信息不返回，页面按 category 本地文案）。
 * - `/editor_pick_list_history`：body `{loadMoreKey?}`；上游 body `{data:[{date,dateIsoStr,picks:[{episode,comment}]}], loadMoreKey?}`。
 * - `/pilot_discovery_list`：body `{loadMoreKey?}`；上游 body `{data:[{episode, …}]}`。
 */

export const topListAPI = (params: TopListParams) =>
  alova.Post<unknown>('/top_list', params).then((raw) =>
    unwrapPage<unknown>(raw)
      .items.map((entry) => unwrapItem<EpisodeBasic>(entry))
      .filter((episode): episode is EpisodeBasic => episode !== null),
  )

export const editorPickListHistoryAPI = (params?: EditorPickListHistoryParams) =>
  alova
    .Post<PageResult<EditorPickGroup, string>>('/editor_pick_list_history', params ?? {})
    .then((raw) => unwrapPage<EditorPickGroup, string>(raw))

export const pilotDiscoveryListAPI = (params?: PilotDiscoveryListParams) =>
  alova
    .Post<EpisodeBasic[]>('/pilot_discovery_list', params ?? {})
    .then((raw) => pluckList<unknown, EpisodeBasic>(raw, 'episode'))
