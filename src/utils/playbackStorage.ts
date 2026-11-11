import type { EpisodeBasic } from '@/api/types'

/** 本地缓存的播放现场：刷新/重开页面先靠它立刻恢复，再和服务端对账。 */
export interface StoredPlaybackState {
  episode: EpisodeBasic
  progress: number
  duration: number
  /** 最后一次进度变更时间（ISO，用于和服务端做 LWW 比较） */
  playedAt: string
  /** 本地写入时间戳，仅用于节流 */
  updatedAt: number
}

const STORAGE_KEY = 'xyz:playback-state'

export function loadPlaybackState(): StoredPlaybackState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredPlaybackState
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.episode || typeof parsed.episode.eid !== 'string') return null
    if (typeof parsed.progress !== 'number' || !isFinite(parsed.progress)) return null
    return parsed
  } catch {
    return null
  }
}

export function savePlaybackState(state: StoredPlaybackState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 本地存储不可用不影响播放
  }
}

export function clearPlaybackState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
