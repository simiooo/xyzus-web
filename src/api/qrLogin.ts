/**
 * 网页扫码登录（同源代理）。
 *
 * 上游（2026-11-11 实测，与官方 accounts.xiaoyuzhoufm.com 登录页同一套接口）：
 * - `POST https://web-api.xiaoyuzhoufm.com/v1/auth/qrcode/create`
 *   headers: `content-type: application/json` + `x-midway-app-id: v6worU4NnWyL`
 *   body: `{"clientId":"xyz-web"}`
 *   → `{"id":"...","url":"https://h5.xiaoyuzhoufm.com/oauth?qrcode_id=..."}`
 * - `POST https://web-api.xiaoyuzhoufm.com/v1/auth/qrcode/login`
 *   body: `{"id":"<上面的 id>"}`
 *   → 等待 `{"status":"WAITTING"}`（上游拼写如此）/ 已扫 `SCANNED` / 成功 `USED`|`CONFIRMED`，
 *     成功时两个 token 在**响应头** `x-jike-access-token` / `x-jike-refresh-token`。
 *   → 过期/无效：HTTP 401 或 400 + `{"code":21,...}`。
 *
 * 浏览器端一律请求同源 `/qrcode-api/*`：上游 CORS 只回显官方域与 localhost，
 * 自建域名会被拦；dev 由 Vite 代理、生产由 nginx 代理（两边规则一致）。
 */

const QR_API_BASE = '/qrcode-api'
const CLIENT_ID = 'xyz-web'

export type QrLoginStatus = 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'consumed' | 'unknown'

export interface QrLoginSession {
  id: string
  /** 二维码里要编码的地址（用手机小宇宙 App 扫它） */
  url: string
}

export interface QrLoginPollResult {
  status: QrLoginStatus
  /** 上游原始 status，便于排查 */
  rawStatus?: string
  accessToken?: string
  refreshToken?: string
}

const NETWORK_HINT =
  '连不上登录服务：请确认前端与后端都在运行（dev 代理 /qrcode-api），也可以改用「Token 登录」。'

interface UpstreamError {
  code?: number
  message?: string
  toast?: string
}

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

function upstreamMessage(data: UpstreamError | null): string {
  if (!data) return ''
  return data.message || data.toast || ''
}

/** 创建一个扫码会话（id + 二维码内容地址） */
export async function createQrLoginSession(): Promise<QrLoginSession> {
  let response: Response
  try {
    response = await fetch(`${QR_API_BASE}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: CLIENT_ID }),
    })
  } catch {
    throw new Error(NETWORK_HINT)
  }

  const data = await readJsonSafe<{ id?: string; url?: string } & UpstreamError>(response)
  if (!response.ok || !data?.id || !data?.url) {
    const detail = upstreamMessage(data)
    throw new Error(
      detail && detail.length <= 60
        ? `二维码获取失败：${detail}`
        : `二维码获取失败（HTTP ${response.status}），请稍后重试。`,
    )
  }
  return { id: data.id, url: data.url }
}

/** 轮询扫码结果；确认登录时带回两个 token */
export async function pollQrLoginSession(id: string): Promise<QrLoginPollResult> {
  let response: Response
  try {
    response = await fetch(`${QR_API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  } catch {
    throw new Error(NETWORK_HINT)
  }

  const accessToken = response.headers.get('x-jike-access-token') ?? undefined
  const refreshToken = response.headers.get('x-jike-refresh-token') ?? undefined
  const data = await readJsonSafe<{ status?: string } & UpstreamError>(response)
  const rawStatus = String(data?.status ?? '').toUpperCase()

  if (accessToken && refreshToken) {
    return { status: 'confirmed', rawStatus, accessToken, refreshToken }
  }

  // 过期 / 无效二维码：上游用 401 或 400 + code 21 表示
  if (!response.ok) {
    if (response.status === 401 || data?.code === 21 || /过期|失效|无效|not found/i.test(upstreamMessage(data))) {
      return { status: 'expired', rawStatus: rawStatus || `HTTP_${response.status}` }
    }
    throw new Error(`扫码状态查询失败（HTTP ${response.status}），请刷新二维码重试。`)
  }

  switch (rawStatus) {
    case 'WAITTING':
    case 'WAITING':
    case 'PENDING':
      return { status: 'waiting', rawStatus }
    case 'SCANNED':
    case 'SCANNED_QRCODE':
    case 'CONFIRMING':
      return { status: 'scanned', rawStatus }
    case 'USED':
    case 'CONFIRMED':
    case 'SUCCESS':
    case 'OK':
      // 上游只在成功那一次响应里给 token；如果这次没拿到，说明凭证已被消费掉了，
      // 只能重新扫码（不要傻等，也不要误报成网络错误）。
      return { status: 'consumed', rawStatus }
    case 'EXPIRED':
    case 'INVALID':
    case 'CANCELED':
    case 'CANCELLED':
      return { status: 'expired', rawStatus }
    default:
      return { status: 'unknown', rawStatus }
  }
}
