/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 语义色：全部指向 CSS 变量，主题切换只改变量
        page: 'var(--background)',
        surface: 'var(--surface)',
        sunken: 'var(--sunken)',
        muted: 'var(--muted)',
        'muted-hover': 'var(--muted-hover)',
        'muted-strong': 'var(--muted-strong)',
        select: 'var(--select)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-muted': 'var(--muted-foreground)',
        faint: 'var(--faint)',
        line: 'var(--border)',
        hairline: 'var(--hairline)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-ink': 'var(--accent-ink)',
        'accent-soft': 'var(--accent-container)',
        destructive: 'var(--destructive)',
        'destructive-soft': 'var(--destructive-container)',
        positive: 'var(--positive)',
        'positive-soft': 'var(--positive-container)',

        // 兼容旧页面的类名（迁移期用，页面重写完成后可删）
        'bg-base': 'var(--background)',
        'bg-surface': 'var(--surface)',
        'bg-surface-elevated': 'var(--muted)',
        'bg-sidebar': 'var(--background)',
        'accent-primary': 'var(--accent)',
        'accent-primary-hover': 'var(--accent-hover)',
        'accent-primary-active': 'var(--accent-active)',
        'text-primary': 'var(--ink)',
        'text-secondary': 'var(--muted-foreground)',
        'text-tertiary': 'var(--faint)',
        'border-subtle': 'var(--border)',
        'border-active': 'var(--hairline)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Microsoft YaHei UI"',
          '"Noto Sans CJK SC"',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          '"SF Mono"',
          '"Cascadia Mono"',
          '"Roboto Mono"',
          'Consolas',
          'monospace',
        ],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        float: 'var(--shadow-float)',
        sheet: 'var(--shadow-sheet)',
      },
      spacing: {
        rail: 'var(--rail)',
        player: 'var(--player-h)',
        tabbar: 'var(--tabbar-h)',
      },
      screens: {
        xs: '420px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.24s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'fade-in': 'fade-in 0.3s ease both',
        'sheet-up': 'sheet-up 0.28s cubic-bezier(0.22, 0.61, 0.36, 1) both',
      },
    },
  },
  plugins: [],
  corePlugins: {
    // Ant Design 自己管 reset，不用 Tailwind 的 preflight
    preflight: false,
  },
}
