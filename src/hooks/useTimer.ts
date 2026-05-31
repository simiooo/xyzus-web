import { useRef, useEffect } from 'react'

export function useTimer() {
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (ref.current !== null) {
        clearInterval(ref.current)
      }
    }
  }, [])

  const set = (fn: () => void, ms: number) => {
    if (ref.current !== null) clearInterval(ref.current)
    ref.current = setInterval(fn, ms)
    return () => {
      if (ref.current !== null) {
        clearInterval(ref.current)
        ref.current = null
      }
    }
  }

  const clear = () => {
    if (ref.current !== null) {
      clearInterval(ref.current)
      ref.current = null
    }
  }

  return { set, clear }
}
