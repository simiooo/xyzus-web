/**
 * 离线 Mock 数据层入口
 *
 * 页面上只需要：
 *   `import { createMockAdapter } from '@/mock'`
 *   `requestAdapter: createMockAdapter()`
 *
 * 具体数据在 fixtures.ts，端点解析在 handlers.ts，adapter 在 adapter.ts。
 */
import { createMockAdapter } from './adapter.ts'

export { createMockAdapter, isMockEnabled, MOCK_ENDPOINT_LIST } from './adapter.ts'
export { fixtures } from './fixtures.ts'
export { resolveMockResponse } from './handlers.ts'

export default createMockAdapter
