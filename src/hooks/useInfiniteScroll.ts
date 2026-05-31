import { useRef, useEffect } from 'react'

export function useInfiniteScroll(
  onLoadMore: () => void,
  options?: { threshold?: number; enabled?: boolean }
) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || options?.enabled === false) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMoreRef.current()
        }
      },
      { threshold: options?.threshold ?? 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [options?.threshold, options?.enabled])

  return sentinelRef
}
