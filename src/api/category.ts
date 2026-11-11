import alova from '@/alova'
import { unwrapList, unwrapPage } from '@/api/normalize'
import type { CategoryParams, ImageUrls, PageResult, PodcastBasic } from '@/api/types'

/**
 * 分类接口契约（来源：D:\work\xyz-backend\handlers\category.go + doc\docs\category*.md）：
 * - `/category_list`：body 空；上游 body `{data:[{id,name,emoji,icon:<ImageUrls>}]}`。
 * - `/category_list_tab`：body `{categoryId}`；上游 body `{data:[{id,name}]}`。
 * - `/category_podcast_list`：body `{categoryId, tab, loadMoreKey?:number}`（后端 LoadMoreKey 是 int，
 *   旧客户端类型写成 string 是错的）；上游 body `{data:[{podcast:<podcast>, …}], loadMoreKey?}`。
 */

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

export interface CategoryPodcastItem {
  podcast: PodcastBasic
  episode?: unknown
}

export const categoryListAPI = () =>
  alova.Post<CategoryInfo[]>('/category_list').then((raw) => unwrapList<CategoryInfo>(raw))

export const categoryListTabAPI = (categoryId: string) =>
  alova
    .Post<CategoryTab[]>('/category_list_tab', { categoryId })
    .then((raw) => unwrapList<CategoryTab>(raw))

export const categoryPodcastListAPI = (params: CategoryParams) =>
  alova
    .Post<PageResult<CategoryPodcastItem, number>>('/category_podcast_list', params)
    .then((raw) => unwrapPage<CategoryPodcastItem, number>(raw))
