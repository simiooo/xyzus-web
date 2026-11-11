import { create } from 'zustand'
import {
  applyAccentToDocument,
  applyAppearanceToDocument,
  readStoredAccent,
  readStoredAppearance,
  type AccentName,
  type Appearance,
} from '@/theme'

interface ThemeState {
  accent: AccentName
  appearance: Appearance
  setAccent: (accent: AccentName) => void
  toggleAccent: () => void
  setAppearance: (appearance: Appearance) => void
  toggleAppearance: () => void
}

/** 允许 `?theme=dark&accent=pink` 直接预览/分享某种外观；没写就沿用本地存储 */
function readUrlPreview<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const value = new URLSearchParams(window.location.search).get(key)
    if (value && (allowed as readonly string[]).includes(value)) return value as T
  } catch {
    // 非浏览器环境忽略
  }
  return null
}

const initialAccent = readUrlPreview<AccentName>('accent', ['blue', 'pink']) ?? readStoredAccent()
const initialAppearance = readUrlPreview<Appearance>('theme', ['light', 'dark']) ?? readStoredAppearance()
applyAccentToDocument(initialAccent)
applyAppearanceToDocument(initialAppearance)

const useThemeStore = create<ThemeState>((set, get) => ({
  accent: initialAccent,
  appearance: initialAppearance,

  setAccent: (accent: AccentName) => {
    applyAccentToDocument(accent)
    try {
      localStorage.setItem('xyz:accent', accent)
    } catch {
      // 存不下就算了，页面已经切了
    }
    set({ accent })
  },

  toggleAccent: () => {
    const next: AccentName = get().accent === 'blue' ? 'pink' : 'blue'
    get().setAccent(next)
  },

  setAppearance: (appearance: Appearance) => {
    applyAppearanceToDocument(appearance)
    try {
      localStorage.setItem('xyz:appearance', appearance)
    } catch {
      // 同上
    }
    set({ appearance })
  },

  toggleAppearance: () => {
    const next: Appearance = get().appearance === 'light' ? 'dark' : 'light'
    get().setAppearance(next)
  },
}))

export default useThemeStore
