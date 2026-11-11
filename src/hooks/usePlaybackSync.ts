import { useEffect, useRef } from 'react'
import { App as AntdApp } from 'antd'
import {
  episodePlayedCreateAPI,
  episodePlayedHistoryAPI,
  playbackProgressListAPI,
} from '@/api/playback'
import { enqueueOutbox } from '@/db/outbox'
import useAudioStore from '@/stores/audioStore'
import useAuthStore from '@/stores/authStore'
import { loadPlaybackState, savePlaybackState } from '@/utils/playbackStorage'
import { formatDurationShort } from '@/utils/format'
import type { EpisodeBasic } from '@/api/types'

const SYNC_INTERVAL_MS = 10_000
const REMOTE_NEWER_MS = 5_000
const LOCAL_PERSIST_GAP_MS = 2_000
const PUSH_GAP_MS = 8_000

/**
 * 播放现场同步（对齐手机端「分布式续听」）：
 * 1. 本地快照：任何进度变化落 localStorage（节流 2s），刷新/重开页面先立刻恢复（暂停态）；
 * 2. 跨端恢复：启动时拉「最近收听 + 服务端进度」，按 playedAt 取最新一集恢复；
 * 3. 上报：播放中每 10s / 暂停 / seek / 页面隐藏时 POST playback_progress_update（带 playedAt）；
 * 4. 冲突协调：playedAt 最后写入优先。本端正在播放时不让远端覆盖；
 *    页面重新可见且本端暂停时，若远端 playedAt 明显更新则自动 seek 到远端进度并提示。
 */
export default function usePlaybackSync() {
  const userId = useAuthStore((s) => s.user?.uid)
  const { message } = AntdApp.useApp()
  const messageRef = useRef(message)
  useEffect(() => {
    messageRef.current = message
  }, [message])

  const localRestoredRef = useRef(false)
  const remoteRestoredForRef = useRef<string | null>(null)
  const lastPersistRef = useRef<{ at: number; progress: number } | null>(null)
  const lastPushRef = useRef<{ at: number; progress: number } | null>(null)
  const createdRef = useRef<string | null>(null)

  useEffect(() => {
    const persistLocal = (
      episode: EpisodeBasic,
      progress: number,
      duration: number,
      playedAt: string,
      force = false,
    ) => {
      const now = Date.now()
      const last = lastPersistRef.current
      if (!force && last && now - last.at < LOCAL_PERSIST_GAP_MS && Math.abs(progress - last.progress) < 1) {
        return
      }
      lastPersistRef.current = { at: now, progress }
      savePlaybackState({ episode, progress, duration, playedAt, updatedAt: now })
    }

    const pushRemote = (force = false) => {
      if (!userId) return
      const state = useAudioStore.getState()
      const episode = state.currentEpisode
      if (!episode) return
      const progress = Math.round(state.currentTime)
      if (progress <= 0) return
      const now = Date.now()
      const last = lastPushRef.current
      if (!force && last && now - last.at < PUSH_GAP_MS && Math.abs(progress - last.progress) < 3) {
        return
      }
      if (!force && !state.isPlaying && last && now - last.at < PUSH_GAP_MS) return
      lastPushRef.current = { at: now, progress }
      // 进度写入走 outbox：本地先落库，失败自动退避重试，页面关闭也不丢
      void enqueueOutbox(
        'playback_progress',
        {
          eid: episode.eid,
          pid: episode.podcast?.pid,
          playedAt: new Date(now).toISOString(),
          progress,
        },
        episode.eid,
      ).catch(() => {
        lastPushRef.current = last
      })
    }

    // ---------- 1. 启动恢复：本地快照立刻恢复（服务端对账在下面单独 effect） ----------
    if (!localRestoredRef.current) {
      localRestoredRef.current = true
      const local = loadPlaybackState()
      if (local && !useAudioStore.getState().currentEpisode) {
        // 恢复不算「开始收听」，避免每次刷新都往最近播放里插一条
        createdRef.current = local.episode.eid
        useAudioStore.getState().restorePlayback(local.episode, local.progress, local.duration)
      }
    }

    // ---------- 2. 进度变化：本地快照 + 关键节点上报 ----------
    const unsubscribe = useAudioStore.subscribe((state, prev) => {
      const episode = state.currentEpisode
      if (!episode) return

      const duration = state.duration || episode.duration || 0
      const progress = state.currentTime
      const pauseTransition = prev.isPlaying && !state.isPlaying
      const seeked = prev.seekRequest !== state.seekRequest
      const episodeChanged = prev.currentEpisode?.eid !== episode.eid

      // 新的一集：记录一次「开始收听」，更新服务端最近播放
      if (episodeChanged && userId && createdRef.current !== episode.eid) {
        createdRef.current = episode.eid
        void episodePlayedCreateAPI(episode.eid).catch(() => {})
      }

      if (progress > 0) {
        const local = loadPlaybackState()
        const keepRestoredTimestamp = !state.isPlaying && !pauseTransition && !seeked && local?.episode.eid === episode.eid
        const playedAt = keepRestoredTimestamp ? local.playedAt : new Date().toISOString()
        persistLocal(episode, progress, duration, playedAt, pauseTransition || seeked || episodeChanged)
      }

      if (pauseTransition || seeked) pushRemote(true)
    })

    // ---------- 3. 定时上报 + 页面可见性 ----------
    const interval = window.setInterval(() => {
      if (useAudioStore.getState().isPlaying) pushRemote()
    }, SYNC_INTERVAL_MS)

    const refreshRemoteForCurrent = async () => {
      if (!userId) return
      const current = useAudioStore.getState()
      const episode = current.currentEpisode
      if (!episode || current.isPlaying) return
      const local = loadPlaybackState()
      if (!local || local.episode.eid !== episode.eid) return
      try {
        const records = await playbackProgressListAPI([episode.eid])
        const remote = records[0]
        if (!remote) return
        const remoteAt = Date.parse(remote.playedAt)
        const localAt = Date.parse(local.playedAt)
        if (!Number.isFinite(remoteAt) || remoteAt <= localAt + REMOTE_NEWER_MS) return
        if (Math.abs(remote.progress - current.currentTime) < 3) return
        useAudioStore.getState().seekTo(remote.progress)
        savePlaybackState({
          episode,
          progress: remote.progress,
          duration: current.duration || episode.duration || 0,
          playedAt: remote.playedAt,
          updatedAt: Date.now(),
        })
        lastPersistRef.current = { at: Date.now(), progress: remote.progress }
        messageRef.current.info(`已同步其他设备的播放进度：${formatDurationShort(remote.progress)}`)
      } catch {
        // 静默
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const state = useAudioStore.getState()
        if (state.currentEpisode && state.currentTime > 0) {
          savePlaybackState({
            episode: state.currentEpisode,
            progress: state.currentTime,
            duration: state.duration || state.currentEpisode.duration || 0,
            playedAt: new Date().toISOString(),
            updatedAt: Date.now(),
          })
        }
        pushRemote(true)
      } else {
        void refreshRemoteForCurrent()
      }
    }

    const onPageHide = () => {
      const state = useAudioStore.getState()
      if (state.currentEpisode && state.currentTime > 0) {
        savePlaybackState({
          episode: state.currentEpisode,
          progress: state.currentTime,
          duration: state.duration || state.currentEpisode.duration || 0,
          playedAt: new Date().toISOString(),
          updatedAt: Date.now(),
        })
      }
      pushRemote(true)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      unsubscribe()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [userId])

  // ---------- 4. 跨端恢复：登录态就绪后再拉服务端最近进度对账（每个账号只做一次） ----------
  useEffect(() => {
    if (!userId || remoteRestoredForRef.current === userId) return
    remoteRestoredForRef.current = userId
    let cancelled = false

    const restoreRemote = async () => {
      try {
        const recent = await episodePlayedHistoryAPI()
        const eids = recent.slice(0, 5).map((episode) => episode.eid)
        if (!eids.length) return

        const records = await playbackProgressListAPI(eids)
        if (!records.length) return
        const remote = records.reduce((latest, item) =>
          new Date(item.playedAt).getTime() > new Date(latest.playedAt).getTime() ? item : latest,
        )
        const remoteAt = Date.parse(remote.playedAt)
        const localState = loadPlaybackState()
        const localAt = localState ? Date.parse(localState.playedAt) : 0
        const current = useAudioStore.getState()
        if (cancelled || current.isPlaying) return
        if (!Number.isFinite(remoteAt) || remoteAt <= localAt + REMOTE_NEWER_MS) return

        const episode =
          current.currentEpisode?.eid === remote.eid
            ? current.currentEpisode
            : recent.find((item) => item.eid === remote.eid)
        if (!episode) return

        // 跨端恢复同样不算「开始收听」
        createdRef.current = episode.eid
        useAudioStore.getState().restorePlayback(episode, remote.progress, episode.duration || 0)
        const now = Date.now()
        lastPersistRef.current = { at: now, progress: remote.progress }
        savePlaybackState({
          episode,
          progress: remote.progress,
          duration: episode.duration || 0,
          playedAt: remote.playedAt,
          updatedAt: now,
        })
        messageRef.current.info(
          `已同步其他设备的播放进度：${episode.title.slice(0, 18)}${episode.title.length > 18 ? '…' : ''} ${formatDurationShort(remote.progress)}`,
        )
      } catch {
        // 未登录 / 离线 / 接口暂不可用：保留本地恢复结果即可
      }
    }

    void Promise.resolve().then(restoreRemote)
    return () => {
      cancelled = true
      // StrictMode 会先挂载→卸载→再挂载：首轮被取消时必须放掉一次性标记，
      // 否则第二轮会以为「已恢复过」而直接跳过。
      if (remoteRestoredForRef.current === userId) remoteRestoredForRef.current = null
    }
  }, [userId])
}
