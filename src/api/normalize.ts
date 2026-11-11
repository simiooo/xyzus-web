import type { PageResult } from '@/api/types'

/**
 * 归一化工具：xyz 后端统一信封 `{code,msg,data}` 会被 alova 拦截器剥掉一层，
 * 但 `data` 里面仍然是「上游原始 JSON」，不同端点/不同版本的包裹层数不一致：
 *
 *   /discovery            data = { data: [...sections], loadMoreKey }
 *   /top_list             data = { data: { items: [{ item: <episode> }] } }
 *   /subscription         data = { data: [...podcasts], loadMoreKey }  或
 *                         data = { data: { data: [...], loadMoreKey } }
 *   /comment_collect_list data = { data: [...comments], loadMoreKey }
 *   /profile              data = { data: <user> }
 *
 * 页面只应该拿到干净数据，包裹层全部在这里吃掉。这里对「包裹」和「已干净的
 * 形状」都容忍，mock 数据层（拦截器之后）无论给哪一种都能通过。
 */

const MAX_UNWRAP_DEPTH = 4

/** 剥掉 `{ data: ... }` 包裹层（最多 4 层），拿到真正的载荷。 */
export function unwrapData<T>(input: unknown): T {
  let value: unknown = input

  for (let depth = 0; depth < MAX_UNWRAP_DEPTH; depth += 1) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) break

    const record = value as Record<string, unknown>
    if (!('data' in record)) break

    const inner = record.data
    if (inner === undefined || inner === null) break
    value = inner
  }

  return value as T
}

const LIST_KEYS = ['data', 'items', 'list', 'episodes', 'picks', 'results', 'users'] as const

/** 从任意包裹里取出数组；取不到返回 `[]`（页面不需要再判空）。 */
export function unwrapList<T>(input: unknown): T[] {
  const value = unwrapData<unknown>(input)

  if (Array.isArray(value)) return value as T[]

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of LIST_KEYS) {
      if (Array.isArray(record[key])) return record[key] as T[]
    }
  }

  return []
}

/** 在多层包裹中找某个字段（loadMoreKey / totalCount / highlightWord 这些分页元数据）。 */
export function findField<T = unknown>(input: unknown, field: string): T | undefined {
  let value: unknown = input

  for (let depth = 0; depth < MAX_UNWRAP_DEPTH; depth += 1) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

    const record = value as Record<string, unknown>
    if (field in record && record[field] !== undefined && record[field] !== null) {
      return record[field] as T
    }
    if (!('data' in record)) return undefined
    value = record.data
  }

  return undefined
}

/**
 * 归一化「分页列表」：统一成 `{ items, loadMoreKey?, totalCount? }`。
 * 兼容 `{data:[...],loadMoreKey}`、`{data:{data:[...],loadMoreKey}}`、纯数组。
 */
export function unwrapPage<T, K = unknown>(input: unknown): PageResult<T, K> {
  const page: PageResult<T, K> = { items: unwrapList<T>(input) }

  const loadMoreKey = findField<K>(input, 'loadMoreKey')
  if (loadMoreKey !== undefined) page.loadMoreKey = loadMoreKey

  const totalCount = findField<number>(input, 'totalCount') ?? findField<number>(input, 'total')
  if (totalCount !== undefined) page.totalCount = totalCount

  return page
}

/** 把 `{ item: T }`（top_list 的榜单条目）或裸 `T` 摊平成 `T`。 */
export function unwrapItem<T>(input: unknown): T | null {
  if (!input || typeof input !== 'object') return null

  const record = input as Record<string, unknown>
  if ('item' in record && record.item && typeof record.item === 'object') {
    return record.item as T
  }
  return input as T
}

/**
 * 取数组里每个条目上某个字段（例如 `[{episode: <episode>}]` → `[<episode>]`）。
 * 条目本身就是目标类型（没有该字段）时原样保留，兼容 mock 的干净形状。
 */
export function pluckList<T, U>(input: unknown, key: string): U[] {
  return unwrapList<T>(input)
    .map((entry) => {
      if (entry && typeof entry === 'object' && key in (entry as Record<string, unknown>)) {
        return (entry as Record<string, unknown>)[key]
      }
      return entry
    })
    .filter((entry): entry is U => entry !== undefined && entry !== null)
}
