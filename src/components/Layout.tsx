import { Outlet, useLocation } from 'react-router'
import { useEffect, useRef } from 'react'
import useAudioStore from '@/stores/audioStore'
import useUiStore from '@/stores/uiStore'
import usePlayerShortcuts from '@/hooks/usePlayerShortcuts'
import usePlaybackSync from '@/hooks/usePlaybackSync'
import useLocalSync from '@/hooks/useLocalSync'
import useUnreadCount from '@/hooks/useUnreadCount'
import Rail from './shell/Rail'
import TopBar from './shell/TopBar'
import RightSidebar from './shell/RightSidebar'
import PlayerBar from './shell/PlayerBar'
import PlayerSheet from './shell/PlayerSheet'
import CommentsSheet from './shell/CommentsSheet'
import MobileTabs from './shell/MobileTabs'

/**
 * X 式三列外壳：左导航（232）+ 中间内容（640）+ 右侧栏（320）。
 * 窄屏去掉右栏、再窄去掉左栏，中间始终是同一列。
 * 超宽屏时整个外壳作为一块画布居中。
 */
export default function Layout() {
  const location = useLocation()
  const currentEpisode = useAudioStore((s) => s.currentEpisode)
  const setPlayerSheetOpen = useUiStore((s) => s.setPlayerSheetOpen)
  const mainRef = useRef<HTMLElement>(null)

  usePlayerShortcuts()
  usePlaybackSync()
  useLocalSync()
  useUnreadCount()

  // 换页：回到页面顶部
  useEffect(() => {
    window.scrollTo(0, 0)
    mainRef.current?.scrollTo?.(0, 0)
  }, [location.pathname])

  // 换台时不要停留在上一个页面的展开态
  useEffect(() => {
    if (!currentEpisode) setPlayerSheetOpen(false)
  }, [currentEpisode, setPlayerSheetOpen])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-[var(--shell-max)]">
        <Rail />

        <div className="min-w-0 flex-1">
          <TopBar />

          <main
            ref={mainRef}
            className="w-full px-4 pb-24 pt-3 lg:px-5 lg:pt-4"
            style={{
              paddingBottom: currentEpisode
                ? 'calc(var(--tabbar-h) + var(--player-h) + 32px)'
                : 'calc(var(--tabbar-h) + 24px)',
            }}
          >
            <Outlet />
          </main>
        </div>

        <RightSidebar />
      </div>

      <PlayerBar />
      <PlayerSheet />
      <CommentsSheet />
      <MobileTabs />
    </div>
  )
}
