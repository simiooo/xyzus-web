import type { ThemeConfig } from 'antd'

/** 强调色：主题色只在需要强调的地方（播放按钮、进度、正在播放标记）出现 */
export type AccentName = 'blue' | 'pink'

/** 外观：白&墨（默认）与夜间两套 */
export type Appearance = 'light' | 'dark'

export const ACCENT_STORAGE_KEY = 'xyz:accent'
export const APPEARANCE_STORAGE_KEY = 'xyz:appearance'

export const ACCENT_LABELS: Record<AccentName, string> = {
  blue: '蓝色',
  pink: '粉色',
}

export const ACCENTS: AccentName[] = ['blue', 'pink']

/** 色板小圆点用的实色：夜间版本亮一档，避免在暗底上发闷 */
export const ACCENT_SWATCH: Record<Appearance, Record<AccentName, string>> = {
  light: { blue: '#2563EB', pink: '#D6336C' },
  dark: { blue: '#2E6BD8', pink: '#C93C74' },
}

export function readStoredAccent(): AccentName {
  try {
    const raw = localStorage.getItem(ACCENT_STORAGE_KEY)
    if (raw === 'pink' || raw === 'blue') return raw
  } catch {
    // localStorage 不可用时用默认
  }
  return 'blue'
}

export function applyAccentToDocument(accent: AccentName) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-accent', accent)
}

export function readStoredAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (raw === 'dark') return 'dark'
  } catch {
    // 同上
  }
  return 'light'
}

export function applyAppearanceToDocument(appearance: Appearance) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', appearance)
  document.documentElement.style.colorScheme = appearance
  const meta = document.querySelector('meta[name="color-scheme"]')
  if (meta) meta.setAttribute('content', appearance)
}

// 与 index.css 的 --system-font 保持一致：MiSans（中文+拉丁），失败退回系统字体
const SYSTEM_FONT =
  '"MiSans", "MiSans VF", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei UI", "Noto Sans CJK SC", system-ui, sans-serif'

/** 两套底色：白&墨 / 夜间。所有组件 token 都从这里取值，不再写死十六进制。 */
interface Palette {
  bg: string
  surface: string
  sunken: string
  muted: string
  mutedHover: string
  mutedStrong: string
  ink: string
  inkSoft: string
  mutedFg: string
  faint: string
  border: string
  borderSecondary: string
  hairline: string
  mask: string
  shadowSecondary: string
  shadowModal: string
  success: string
  warning: string
  error: string
  tooltipBg: string
  tooltipText: string
}

const LIGHT: Palette = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  sunken: '#F7F7F5',
  muted: '#F2F1EE',
  mutedHover: '#E8E7E3',
  mutedStrong: '#E3E1DB',
  ink: '#141414',
  inkSoft: '#3A3A38',
  mutedFg: '#6B6963',
  faint: '#8A8781',
  border: '#E9E7E2',
  borderSecondary: '#F1EFEB',
  hairline: '#C9C6BE',
  mask: 'rgba(20, 20, 20, 0.4)',
  shadowSecondary: '0 12px 32px rgba(20, 20, 20, 0.10)',
  shadowModal: '0 24px 64px rgba(20, 20, 20, 0.18)',
  success: '#38654E',
  warning: '#9A6B12',
  error: '#AE3E35',
  tooltipBg: '#141414',
  tooltipText: '#FFFFFF',
}

const DARK: Palette = {
  bg: '#0E0E0D',
  surface: '#121211',
  sunken: '#171716',
  muted: '#1C1C1A',
  mutedHover: '#252523',
  mutedStrong: '#2C2C29',
  ink: '#F2F1EC',
  inkSoft: '#D8D6CF',
  mutedFg: '#A3A199',
  faint: '#7D7B73',
  border: '#262624',
  borderSecondary: '#1E1E1C',
  hairline: '#3A3A36',
  mask: 'rgba(0, 0, 0, 0.6)',
  shadowSecondary: '0 12px 32px rgba(0, 0, 0, 0.5)',
  shadowModal: '0 24px 64px rgba(0, 0, 0, 0.6)',
  success: '#7FB894',
  warning: '#D9B26B',
  error: '#E5807A',
  tooltipBg: '#F2F1EC',
  tooltipText: '#141414',
}

interface AccentTokens {
  fill: string
  hover: string
  ink: string
  container: string
}

const ACCENT_TOKENS: Record<Appearance, Record<AccentName, AccentTokens>> = {
  light: {
    blue: { fill: '#2563EB', hover: '#1D4ED8', ink: '#1D4ED8', container: '#E9EFFD' },
    pink: { fill: '#D6336C', hover: '#C2255C', ink: '#B02A5B', container: '#FCE9F0' },
  },
  // 夜间：填充色比白底版更深、饱和度收一点（避免近黑底上发荧光），
  // 文字/链接用亮一档的 ink；白字的填充按钮对比 ≥ 4.5:1。
  dark: {
    blue: { fill: '#2E6BD8', hover: '#4A84E8', ink: '#8AB4FF', container: '#182A4D' },
    pink: { fill: '#C93C74', hover: '#E15C8F', ink: '#FFA6C4', container: '#3A1A2A' },
  },
}

/**
 * 白&墨主题：主色是墨色（主按钮是墨胶囊），强调色单独交给播放类控件。
 * 夜间模式是同一套凹槽/文字的暗色版本：底色压到近黑，墨色反相成米白，
 * 强调色提亮一档保证在暗底上的可读性。
 */
export function buildTheme(accent: AccentName, appearance: Appearance = 'light'): ThemeConfig {
  const p = appearance === 'dark' ? DARK : LIGHT
  const a = ACCENT_TOKENS[appearance][accent]

  return {
    token: {
      colorPrimary: a.fill,
      colorInfo: a.fill,
      colorLink: a.ink,
      colorSuccess: p.success,
      colorWarning: p.warning,
      colorError: p.error,

      colorBgLayout: p.bg,
      colorBgContainer: p.surface,
      colorBgElevated: p.surface,
      colorBgSpotlight: p.tooltipBg,
      colorBgMask: p.mask,

      colorBorder: p.border,
      colorBorderSecondary: p.borderSecondary,

      colorText: p.ink,
      colorTextSecondary: p.inkSoft,
      colorTextTertiary: p.mutedFg,
      colorTextQuaternary: p.faint,

      colorFill: p.muted,
      colorFillSecondary: p.sunken,
      colorFillTertiary: p.muted,
      colorFillQuaternary: p.sunken,

      fontFamily: SYSTEM_FONT,
      fontSize: 15,
      fontSizeSM: 13,
      fontSizeLG: 17,
      lineHeight: 1.5,

      borderRadius: 14,
      borderRadiusSM: 10,
      borderRadiusLG: 20,
      borderRadiusXS: 8,

      controlHeight: 44,
      controlHeightSM: 36,
      controlHeightLG: 52,

      boxShadow: 'none',
      boxShadowSecondary: p.shadowSecondary,
      boxShadowTertiary: 'none',

      wireframe: false,
      motionDurationMid: '0.18s',
      motionDurationSlow: '0.24s',
    },
    components: {
      Button: {
        fontWeight: 500,
        primaryShadow: 'none',
        defaultShadow: 'none',
        borderRadius: 9999,
        borderRadiusSM: 9999,
        borderRadiusLG: 9999,
        defaultBg: p.muted,
        defaultColor: p.ink,
        defaultBorderColor: 'transparent',
        defaultHoverBg: p.mutedHover,
        defaultHoverColor: p.ink,
        defaultHoverBorderColor: 'transparent',
        defaultActiveBg: p.mutedStrong,
        defaultActiveColor: p.ink,
        defaultActiveBorderColor: 'transparent',
        colorPrimary: a.fill,
        colorPrimaryHover: a.hover,
        colorPrimaryActive: a.hover,
        colorTextLightSolid: '#FFFFFF',
        paddingInline: 18,
        paddingInlineSM: 12,
      },
      Input: {
        colorBgContainer: p.muted,
        colorBorder: 'transparent',
        hoverBorderColor: 'transparent',
        activeBorderColor: a.fill,
        activeShadow: 'none',
        borderRadius: 18,
        borderRadiusLG: 20,
        borderRadiusSM: 16,
        paddingInline: 14,
        controlHeight: 40,
        colorTextPlaceholder: p.faint,
      },
      Select: {
        colorBgContainer: p.muted,
        colorBorder: 'transparent',
        hoverBorderColor: 'transparent',
        activeBorderColor: a.fill,
        activeOutlineColor: 'transparent',
        borderRadius: 18,
        optionSelectedBg: a.container,
        optionActiveBg: p.sunken,
        optionSelectedColor: a.ink,
        optionSelectedFontWeight: 600,
        colorTextPlaceholder: p.faint,
      },
      Tabs: {
        inkBarColor: a.fill,
        itemColor: p.mutedFg,
        itemHoverColor: p.ink,
        itemSelectedColor: p.ink,
        itemActiveColor: p.ink,
        titleFontSize: 14,
        horizontalItemGutter: 22,
        horizontalItemPadding: '8px 0',
      },
      Slider: {
        trackBg: a.fill,
        trackHoverBg: a.hover,
        handleColor: a.fill,
        handleActiveColor: a.hover,
        railBg: p.mutedStrong,
        railHoverBg: p.mutedStrong,
        dotBorderColor: p.mutedStrong,
        dotActiveBorderColor: a.fill,
        railSize: 3,
        handleSize: 10,
        handleSizeHover: 12,
        handleLineWidth: 2,
      },
      Progress: {
        colorPrimary: a.fill,
        defaultColor: a.fill,
        remainingColor: p.mutedStrong,
        lineBorderRadius: 9999,
      },
      Spin: {
        colorPrimary: p.ink,
      },
      Switch: {
        colorPrimary: a.fill,
        trackHeight: 22,
        handleSize: 18,
      },
      Segmented: {
        itemSelectedBg: a.fill,
        itemSelectedColor: '#FFFFFF',
        trackBg: p.muted,
        trackPadding: 3,
        itemColor: p.mutedFg,
        itemHoverColor: p.ink,
        borderRadius: 9999,
        borderRadiusSM: 9999,
        borderRadiusLG: 9999,
      },
      Card: {
        colorBgContainer: p.surface,
        borderRadiusLG: 18,
        paddingLG: 20,
        boxShadowTertiary: 'none',
      },
      Modal: {
        colorBgElevated: p.surface,
        borderRadiusLG: 24,
        boxShadowSecondary: p.shadowModal,
        contentBg: p.surface,
        headerBg: p.surface,
      },
      Drawer: {
        colorBgElevated: p.surface,
      },
      Dropdown: {
        colorBgElevated: p.surface,
        borderRadiusLG: 14,
        controlItemBgActive: p.muted,
        controlItemBgHover: p.sunken,
        borderRadiusSM: 8,
        boxShadowSecondary: p.shadowSecondary,
      },
      Tooltip: {
        colorBgSpotlight: p.tooltipBg,
        borderRadius: 8,
        colorTextLightSolid: p.tooltipText,
        fontSize: 12,
      },
      Tag: {
        borderRadius: 9999,
        defaultBg: p.muted,
        defaultColor: p.inkSoft,
        colorBorder: 'transparent',
        fontSize: 12,
      },
      Badge: {
        colorError: a.fill,
        fontSize: 11,
      },
      Divider: {
        colorSplit: p.borderSecondary,
      },
      Avatar: {
        colorBgContainer: p.mutedStrong,
        colorTextPlaceholder: p.mutedFg,
        borderRadius: 9999,
      },
      Skeleton: {
        gradientFromColor: p.muted,
        gradientToColor: p.sunken,
        borderRadius: 10,
      },
      Message: {
        colorBgElevated: p.surface,
        boxShadow: p.shadowSecondary,
        borderRadiusLG: 9999,
        contentPadding: '10px 18px',
      },
      Notification: {
        colorBgElevated: p.surface,
        borderRadiusLG: 18,
      },
      Breadcrumb: {
        itemColor: p.faint,
        lastItemColor: p.ink,
        linkColor: p.faint,
        separatorColor: p.hairline,
      },
      List: {
        colorBgContainer: 'transparent',
        colorSplit: p.borderSecondary,
      },
      Empty: {
        colorTextDescription: p.mutedFg,
      },
      Collapse: {
        headerBg: 'transparent',
        contentBg: 'transparent',
      },
    },
  }
}

export default buildTheme
