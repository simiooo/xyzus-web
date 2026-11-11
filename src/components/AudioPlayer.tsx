import { useEffect, useRef } from 'react'
import { message } from 'antd'
import { resolveEpisodeAudioUrl } from '@/api/episode'
import useAudioStore from '@/stores/audioStore'

/**
 * 唯一持有 <audio> 的地方。其余组件只读状态、只发意图。
 * 换台时用 `resolveEpisodeAudioUrl` 取地址：公开单集直接播，付费/私密单集
 * 走 `/private_media_get` 兜底，拿不到就给中文提示并暂停，绝不静默失效。
 *
 * 注意起播顺序：`<audio>` 首次挂载时还没有 src，此时调用 `play()` 会被浏览器拒绝
 * （NoSupportedSources），如果把它当成「播放失败」打回暂停，就会出现「点了播放但要再点一次」。
 * 所以这里用 `sourceEidRef` 标记「这一集的音源已经就绪」，播放/暂停 effect 只在就绪后才动它。
 */
export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const currentEpisode = useAudioStore((s) => s.currentEpisode)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const volume = useAudioStore((s) => s.volume)
  const playbackRate = useAudioStore((s) => s.playbackRate)
  const seekRequest = useAudioStore((s) => s.seekRequest)
  const seekTarget = useAudioStore((s) => s.seekTarget)

  /** 已经解析过音源的 eid */
  const prevEidRef = useRef<string | null>(null)
  /** src 已写入音频元素、可以安全 play() 的 eid */
  const sourceEidRef = useRef<string | null>(null)

  // 关掉播放后 audio 元素会卸载，复位标记；下次播同一集需要重新解析地址
  useEffect(() => {
    if (!currentEpisode) {
      prevEidRef.current = null
      sourceEidRef.current = null
    }
  }, [currentEpisode])

  // 换台：解析地址 → 换源 → 按当前播放意图起播
  useEffect(() => {
    const el = audioRef.current
    if (!el || !currentEpisode) return

    const target = currentEpisode
    if (prevEidRef.current === target.eid) return
    prevEidRef.current = target.eid
    sourceEidRef.current = null

    let cancelled = false

    resolveEpisodeAudioUrl(target).then((source) => {
      if (cancelled) return
      if (!source.url) {
        useAudioStore.getState().pause()
        message.error(
          source.reason === 'FETCH_FAILED'
            ? '获取播放地址失败，请检查网络或后端后重试。'
            : '该单集是付费或私密内容，需要先在小宇宙 App 内购买；当前账号拿不到播放地址。',
        )
        return
      }
      el.src = source.url
      el.load()
      el.playbackRate = playbackRate
      el.volume = volume
      sourceEidRef.current = target.eid

      if (useAudioStore.getState().isPlaying) {
        el.play()
          .then(() => useAudioStore.getState()._setLoading(false))
          .catch(() => useAudioStore.getState().pause())
      } else {
        useAudioStore.getState()._setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在换台时解析地址，音量/倍速由下面的 effect 跟随
  }, [currentEpisode])

  // 播放/暂停：音源就绪后才执行
  useEffect(() => {
    const el = audioRef.current
    if (!el || !currentEpisode) return
    if (sourceEidRef.current !== currentEpisode.eid) return
    if (isPlaying) {
      el.play()
        .then(() => useAudioStore.getState()._setLoading(false))
        .catch(() => useAudioStore.getState().pause())
    } else {
      el.pause()
      useAudioStore.getState()._setLoading(false)
    }
  }, [isPlaying, currentEpisode])

  // 音量
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = volume
  }, [volume])

  // 倍速
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.playbackRate = playbackRate
  }, [playbackRate])

  // 跳转
  useEffect(() => {
    const el = audioRef.current
    if (!el || seekRequest === 0) return
    el.currentTime = seekTarget
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在令牌变化时执行一次
  }, [seekRequest])

  if (!currentEpisode) return null

  return (
    <audio
      ref={audioRef}
      preload="metadata"
      onPlaying={() => useAudioStore.getState()._setLoading(false)}
      onCanPlay={() => useAudioStore.getState()._setLoading(false)}
      onWaiting={() => useAudioStore.getState()._setLoading(useAudioStore.getState().isPlaying)}
      onTimeUpdate={(event) => {
        const el = event.currentTarget
        if (el) useAudioStore.getState()._setCurrentTime(el.currentTime)
      }}
      onDurationChange={(event) => {
        const el = event.currentTarget
        if (el && isFinite(el.duration)) useAudioStore.getState()._setDuration(el.duration)
      }}
      onLoadedMetadata={(event) => {
        const el = event.currentTarget
        if (!el) return
        if (isFinite(el.duration)) useAudioStore.getState()._setDuration(el.duration)

        // 刷新/跨端恢复的进度：音源 metadata 就绪后再 seek，避免在 src 还没写入时被忽略
        const resumeAt = useAudioStore.getState().resumeAt
        if (resumeAt != null && Number.isFinite(resumeAt)) {
          const max = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : resumeAt
          el.currentTime = Math.min(Math.max(0, resumeAt), max)
          useAudioStore.getState()._setCurrentTime(el.currentTime)
          useAudioStore.getState()._clearResumeAt()
        }
      }}
      onEnded={() => useAudioStore.getState()._onEnded()}
      onError={() => useAudioStore.getState().pause()}
    />
  )
}
