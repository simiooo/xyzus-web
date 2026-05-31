import { useEffect, useRef } from 'react'
import useAudioStore from '@/stores/audioStore'

export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const prevEidRef = useRef<string | null>(null)
  const store = useAudioStore()
  const { currentEpisode, isPlaying } = store

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentEpisode) return

    const url = currentEpisode.media?.source?.url || currentEpisode.enclosure?.url
    if (!url) return

    const episodeChanged = prevEidRef.current !== currentEpisode.eid

    if (episodeChanged) {
      prevEidRef.current = currentEpisode.eid
      audio.src = url
      audio.load()
      audio.play().catch(() => {})
    } else if (isPlaying) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [currentEpisode?.eid, isPlaying, currentEpisode])

  if (!currentEpisode) return null

  return (
    <audio
      ref={audioRef}
      onTimeUpdate={() => {
        const audio = audioRef.current
        if (audio) store._setCurrentTime(audio.currentTime)
      }}
      onDurationChange={() => {
        const audio = audioRef.current
        if (audio && isFinite(audio.duration)) store._setDuration(audio.duration)
      }}
      onEnded={() => store._onEnded()}
      preload="metadata"
    />
  )
}
