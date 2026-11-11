import alova from '@/alova'
import { findField, unwrapPage, unwrapList } from '@/api/normalize'
import type {
  SearchParams,
  SearchPageResult,
  SearchRawItem,
  SearchLoadMoreKey,
  SearchPresetItem,
} from '@/api/types'

/**
 * 搜索接口契约（来源：D:\work\xyz-backend\handlers\search.go + doc\docs\search*.md）：
 * - `/search`：body `{keyword, type:"ALL"|"PODCAST"|"EPISODE"|"USER", pid?, loadMoreKey?}`；
 *   上游 body `{data:[HEADER/PODCAST/EPISODE/USER/FOOTER/SEARCHED_USERS…], loadMoreKey?, highlightWord?}`。
 * - `/search_preset`：body 空；上游 body `{data:[{type:"FIXED",text,link,…}]}`（旧类型写成 {data:[]} 包裹）。
 * 结果统一归一化成 `{items, loadMoreKey?, highlightWord?}`。
 */

export const searchAPI = (params: SearchParams) =>
  alova.Post<unknown>('/search', params).then((raw) => {
    const page = unwrapPage<SearchRawItem, SearchLoadMoreKey>(raw)
    const result: SearchPageResult = { items: page.items }
    if (page.loadMoreKey !== undefined) result.loadMoreKey = page.loadMoreKey
    const highlightWord = findField<SearchPageResult['highlightWord']>(raw, 'highlightWord')
    if (highlightWord !== undefined) result.highlightWord = highlightWord
    return result
  })

export const searchPresetAPI = () =>
  alova.Post<SearchPresetItem[]>('/search_preset').then((raw) => unwrapList<SearchPresetItem>(raw))
