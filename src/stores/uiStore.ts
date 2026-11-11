import { create } from 'zustand'

interface UiState {
  /** 播放器展开面板 */
  playerSheetOpen: boolean
  setPlayerSheetOpen: (open: boolean) => void
  togglePlayerSheet: () => void

  /** 移动端搜索面板 */
  mobileSearchOpen: boolean
  setMobileSearchOpen: (open: boolean) => void

  /** 播放条右侧的评论浮层 */
  commentsOpen: boolean
  setCommentsOpen: (open: boolean) => void
  toggleComments: () => void
}

const useUiStore = create<UiState>((set) => ({
  playerSheetOpen: false,
  setPlayerSheetOpen: (open: boolean) => set({ playerSheetOpen: open }),
  togglePlayerSheet: () => set((state) => ({ playerSheetOpen: !state.playerSheetOpen })),

  mobileSearchOpen: false,
  setMobileSearchOpen: (open: boolean) => set({ mobileSearchOpen: open }),

  commentsOpen: false,
  setCommentsOpen: (open: boolean) => set({ commentsOpen: open }),
  toggleComments: () => set((state) => ({ commentsOpen: !state.commentsOpen })),
}))

export default useUiStore
