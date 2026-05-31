import alova from '@/alova'
import type { PodcastBasic, CategoryParams, ImageUrls } from '@/api/types'

export interface CategoryInfo {
  id: string
  name: string
  emoji: string
  icon: ImageUrls
}

export interface CategoryTab {
  id: string
  name: string
}

interface CategoryPodcastItem {
  podcast: PodcastBasic
  episode: unknown
}

export const categoryListAPI = () =>
  alova.Post<{ data: CategoryInfo[] }>('/category_list')

export const categoryListTabAPI = (categoryId: string) =>
  alova.Post<{ data: CategoryTab[] }>('/category_list_tab', { categoryId })

export const categoryPodcastListAPI = (params: CategoryParams) =>
  alova.Post<{ data: CategoryPodcastItem[] }>('/category_podcast_list', params)
