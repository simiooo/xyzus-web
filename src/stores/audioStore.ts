import { create } from 'zustand'
import type { EpisodeBasic } from '@/api/types'

const RATE_KEY = 'xyz:rate'

function loadNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const n = Number(raw)
    if (!isFinite(n)) return fallback
    return Math.min(max, Math.max(min, n))
  } catch {
    return fallback
  }
}

function saveNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // 存不下不影响播放
  }
}

interface AudioState {
  currentEpisode: EpisodeBasic | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  playbackRate: number
  /** 正在解析播放地址 / 起播中 */
  isLoading: boolean

  /** 递增的跳转令牌：AudioPlayer 看到它变了就去改 audio.currentTime */
  seekRequest: number
  seekTarget: number

  /** 恢复现场时待应用的进度：AudioPlayer 在音源 metadata 就绪后 seek 到这里并清空 */
  resumeAt: number | null

  play: (episode: EpisodeBasic) => void
  pause: () => void
  resume: () => void
  togglePlay: () => void
  stop: () => void
  seekTo: (seconds: number) => void
  setVolume: (volume: number) => void
  setPlaybackRate: (rate: number) => void

  /** 刷新/跨端恢复：载入一集并停在指定进度（不自动播放，浏览器阻止无手势自动播放） */
  restorePlayback: (episode: EpisodeBasic, progress: number, duration?: number) => void

  _setLoading: (loading: boolean) => void
  _setCurrentTime: (time: number) => void
  _setDuration: (duration: number) => void
  _clearResumeAt: () => void
  _onEnded: () => void
}

const useAudioStore = create<AudioState>((set, get) => ({
  currentEpisode: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  // 音量不持久化：每次打开页面都从最大开始（用户明确要求默认最大），
  // 本次会话内的调节仍然即时生效。
  volume: 1,
  playbackRate: loadNumber(RATE_KEY, 1, 0.5, 3),
  isLoading: false,

  seekRequest: 0,
  seekTarget: 0,
  resumeAt: null,

  play: (episode: EpisodeBasic) => {
    // 同一集再点播放：只恢复播放，不把进度重置回 0
    if (get().currentEpisode?.eid === episode.eid) {
      set({ isPlaying: true })
      return
    }
    set({
      currentEpisode: episode,
      isPlaying: true,
      isLoading: true,
      currentTime: 0,
      duration: episode.duration || 0,
      resumeAt: null,
    })
  },

  pause: () => set({ isPlaying: false, isLoading: false }),

  resume: () => {
    if (get().currentEpisode) set({ isPlaying: true })
  },

  togglePlay: () => set((state) => (state.currentEpisode ? { isPlaying: !state.isPlaying } : state)),

  stop: () =>
    set({
      currentEpisode: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      seekTarget: 0,
      resumeAt: null,
    }),

  seekTo: (seconds: number) => {
    const clamped = Math.max(0, Math.min(seconds, get().duration || seconds))
    set((state) => ({
      seekTarget: clamped,
      currentTime: clamped,
      seekRequest: state.seekRequest + 1,
      resumeAt: null,
    }))
  },

  restorePlayback: (episode: EpisodeBasic, progress: number, duration?: number) => {
    const total = duration && duration > 0 ? duration : episode.duration || 0
    const clamped = Math.max(0, Math.min(progress, total > 0 ? total : progress))
    set({
      currentEpisode: episode,
      isPlaying: false,
      isLoading: false,
      currentTime: clamped,
      duration: total,
      seekTarget: clamped,
      // 不复用 seekRequest：AudioPlayer 在 metadata 就绪后读 resumeAt 定位
      resumeAt: clamped,
    })
  },

  setVolume: (volume: number) => {
    const v = Math.min(1, Math.max(0, volume))
    set({ volume: v })
  },

  setPlaybackRate: (rate: number) => {
    saveNumber(RATE_KEY, rate)
    set({ playbackRate: rate })
  },

  _setLoading: (loading: boolean) => set({ isLoading: loading }),

  _setCurrentTime: (time: number) => set({ currentTime: time }),

  _setDuration: (duration: number) => set({ duration }),

  _clearResumeAt: () => set({ resumeAt: null }),

  _onEnded: () => set({ isPlaying: false, isLoading: false, resumeAt: null }),
}))

export default useAudioStore
