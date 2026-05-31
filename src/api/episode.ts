import alova from '@/alova'
import type {
  EpisodeDetail,
  EpisodeDetailParams,
  EpisodeBasic,
  EpisodeListByFilterParams,
  FavoriteEpisodeUpdateParams,
} from '@/api/types'

export const episodeDetailAPI = (params: EpisodeDetailParams) =>
  alova.Post<{ data: EpisodeDetail }>('/episode_detail', params)

export const episodeListByFilterAPI = (params: EpisodeListByFilterParams) =>
  alova.Post<EpisodeBasic[]>('/episode_list_by_filter', params)

export const favoriteEpisodeUpdateAPI = (params: FavoriteEpisodeUpdateParams) =>
  alova.Post<null>('/favorite_episode_update', params)

export const favoriteEpisodeListAPI = () =>
  alova.Post<{ data: EpisodeBasic[] }>('/favorite_episode_list')
