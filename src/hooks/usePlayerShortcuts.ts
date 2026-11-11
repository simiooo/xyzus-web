import { useEffect } from 'react'
import useAudioStore from '@/stores/audioStore'

/**
 * 全局播放快捷键：空格播放/暂停，← → 前后 15 秒，M 静音/恢复。
 * 正在输入时不响应。
 */
export function usePlayerShortcuts() {
  const hasEpisode = useAudioStore((s) => !!s.currentEpisode)

  useEffect(() => {
    if (!hasEpisode) return

    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (typing) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const state = useAudioStore.getState()

      if (event.code === 'Space') {
        event.preventDefault()
        state.togglePlay()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        state.seekTo(state.currentTime - 15)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        state.seekTo(state.currentTime + 15)
      } else if (event.key === 'm' || event.key === 'M') {
        state.setVolume(state.volume > 0 ? 0 : 1)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [hasEpisode])
}

export default usePlayerShortcuts
