import { create } from 'zustand'

interface AppState {
  searchHistory: string[]
  addSearchHistory: (keyword: string) => void
  clearSearchHistory: () => void
}

const useAppStore = create<AppState>((set) => ({
  searchHistory: [],

  addSearchHistory: (keyword: string) => {
    set((state) => {
      const filtered = state.searchHistory.filter((k) => k !== keyword)
      return { searchHistory: [keyword, ...filtered].slice(0, 20) }
    })
  },

  clearSearchHistory: () => set({ searchHistory: [] }),
}))

export default useAppStore
