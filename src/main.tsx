import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css'
import './index.css'
import Root from './Root.tsx'

/**
 * 启动：开发期先按需装载 mock 数据层（动态 import，生产构建里会被整体剔除），
 * 再挂载 React。mock adapter 通过 window 传给 `src/alova.ts`。
 */
async function bootstrap() {
  if (import.meta.env.DEV) {
    const { createMockAdapter, isMockEnabled } = await import('@/mock')
    if (isMockEnabled()) {
      window.__XYZ_MOCK_ENABLED__ = true
      window.__XYZ_MOCK_ADAPTER__ = createMockAdapter({ enabled: true }) as never
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
}

void bootstrap()
