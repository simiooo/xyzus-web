import { useRef, useEffect } from 'react'

/**
 * 滚动到底自动加载：把哨兵元素放进列表末尾即可。
 * 回调放进 ref，避免每次渲染重建 IntersectionObserver。
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  options?: { threshold?: number; enabled?: boolean },
) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || options?.enabled === false) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMoreRef.current()
        }
      },
      { threshold: options?.threshold ?? 0.1, rootMargin: '0px 0px 240px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [options?.threshold, options?.enabled])

  return sentinelRef
}

export default useInfiniteScroll
