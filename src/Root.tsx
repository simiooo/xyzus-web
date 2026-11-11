import { useMemo } from 'react'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { buildTheme } from '@/theme'
import useThemeStore from '@/stores/themeStore'
import App from '@/App'

/**
 * 主题装配点：强调色变化时重新生成 Ant Design token。
 * 白&墨的基底不变，只有强调色（蓝 / 粉）跟着切。
 */
export default function Root() {
  const accent = useThemeStore((s) => s.accent)
  const appearance = useThemeStore((s) => s.appearance)
  const theme = useMemo(() => buildTheme(accent, appearance), [accent, appearance])

  return (
    <ConfigProvider theme={theme} locale={zhCN} componentSize="middle">
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  )
}
