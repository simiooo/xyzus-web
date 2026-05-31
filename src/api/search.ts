import alova from '@/alova'
import type {
  SearchParams,
  SearchResponse,
  SearchPresetItem,
} from '@/api/types'

export const searchAPI = (params: SearchParams) =>
  alova.Post<SearchResponse>('/search', params)

export const searchPresetAPI = () =>
  alova.Post<{ data: SearchPresetItem[] }>('/search_preset')
