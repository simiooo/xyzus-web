import alova from '@/alova'
import type {
  DiscoveryResponse,
  TopListParams,
  EpisodeBasic,
  EditorPickListHistoryParams,
  PilotDiscoveryListParams,
} from '@/api/types'
import type { DiscoveryParams } from '@/api/types'

export const discoveryAPI = (params?: DiscoveryParams) =>
  alova.Post<DiscoveryResponse>('/discovery', params ?? {})

export const topListAPI = (params: TopListParams) =>
  alova.Post<EpisodeBasic[]>('/top_list', params)

export const editorPickListHistoryAPI = (params?: EditorPickListHistoryParams) =>
  alova.Post<{ date: string; picks: unknown[] }[]>('/editor_pick_list_history', params ?? {})

export const pilotDiscoveryListAPI = (params?: PilotDiscoveryListParams) =>
  alova.Post<EpisodeBasic[]>('/pilot_discovery_list', params ?? {})
