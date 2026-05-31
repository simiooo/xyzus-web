import { create } from 'zustand'
import type { EpisodeBasic } from '@/api/types'

interface AudioState {
  currentEpisode: EpisodeBasic | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number

  play: (episode: EpisodeBasic) => void
  pause: () => void
  resume: () => void
  togglePlay: () => void
  stop: () => void
  setVolume: (volume: number) => void

  _setCurrentTime: (time: number) => void
  _setDuration: (duration: number) => void
  _onEnded: () => void
}

const useAudioStore = create<AudioState>((set) => ({
  currentEpisode: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,

  play: (episode: EpisodeBasic) =>
    set({
      currentEpisode: episode,
      isPlaying: true,
      currentTime: 0,
      duration: episode.duration || 0,
    }),

  pause: () => set({ isPlaying: false }),

  resume: () => set({ isPlaying: true }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  stop: () =>
    set({
      currentEpisode: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }),

  setVolume: (volume: number) => set({ volume }),

  _setCurrentTime: (time: number) => set({ currentTime: time }),

  _setDuration: (duration: number) => set({ duration }),

  _onEnded: () => set({ isPlaying: false, currentTime: 0 }),
}))

export default useAudioStore
