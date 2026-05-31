import alova from '@/alova'
import type {
  PodcastBasic,
  PodcastRelatedItem,
  EpisodeListResponse,
  EpisodeListParams,
} from '@/api/types'

export const podcastDetailAPI = (pid: string) =>
  alova.Post<{ data: PodcastBasic }>('/podcast_detail', { pid })

export const episodeListAPI = (params: EpisodeListParams) =>
  alova.Post<EpisodeListResponse>('/episode_list', params)

export const podcastRelatedAPI = (params: { pid: string }) =>
  alova.Post<{ data: PodcastRelatedItem[] }>('/podcast_related', params)

export const podcastGetInfoAPI = (pid: string) =>
  alova.Post<{ ipLoc: string; organization: string }>('/podcast_get_info', { pid })
