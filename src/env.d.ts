/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /**
   * 开发期 Mock 接入点：`src/main.tsx` 在 DEV 且启用 mock 时注入，
   * `src/alova.ts` 在发请求时读取。生产构建里这两个全局量不会被写入，
   * mock 模块（fixtures 等）也不会进入主包。
   */
  __XYZ_MOCK_ADAPTER__?: import('alova').AlovaRequestAdapter<unknown, unknown, unknown>
  __XYZ_MOCK_ENABLED__?: boolean
}
