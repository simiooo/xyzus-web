/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#1E1814',
        'bg-surface': '#2A231E',
        'bg-surface-elevated': '#352C26',
        'bg-sidebar': '#16100C',
        'accent-primary': '#FF7A45',
        'accent-primary-hover': '#FF9C6E',
        'accent-primary-active': '#E8663A',
        'accent-secondary': '#36CFC9',
        'text-primary': '#FFFFFF',
        'text-secondary': 'rgba(255,255,255,0.65)',
        'text-tertiary': 'rgba(255,255,255,0.55)',
        'text-inverse': '#1E1814',
        'border-subtle': 'rgba(255,255,255,0.10)',
        'border-active': 'rgba(255,255,255,0.20)',
        success: '#73D13D',
        warning: '#FFC53D',
        error: '#FF4D4F',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '48px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        display: ['32px', { lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.02em' }],
        'display-mobile': ['24px', { lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.02em' }],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.30)',
        md: '0 4px 12px rgba(0,0,0,0.35)',
        lg: '0 8px 24px rgba(0,0,0,0.40)',
        glow: '0 0 16px rgba(255,122,69,0.20)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
