import alova from '@/alova'
import { unwrapData } from '@/api/normalize'
import type {
  SendCodeParams,
  SendCodeResult,
  LoginParams,
  LoginResponse,
  LoginSession,
  UserProfile,
} from '@/api/types'

/**
 * 登录相关接口。
 *
 * 后端契约（D:\work\xyz-backend\handlers\login.go / sendcode.go / token.go）：
 * - `/sendCode`：body `{mobilePhoneNumber, areaCode}`；上游 podcaster-api 可能触发阿里云滑块风控，
 *   返回 HTTP 200 + body `{success:false, code:1003, toast:"…"}`（后端信封仍是 code:200）。
 *   所以这里**不能把 data 当 null 丢掉**，要把 payload 交给 authStore 判断 success/toast。
 * - `/login`：body `{mobilePhoneNumber, verifyCode, areaCode}`；成功时 token 在 **上游响应头**，
 *   后端组装为 `{data:{data:<user>, "x-jike-access-token":…, "x-jike-refresh-token":…}}`。
 * - `/profile`：POST 空 body，header 带 access token；上游 body `{data:<user>}`。
 * - `/refresh_token`：body `{"x-jike-access-token":…, "x-jike-refresh-token":…}`；响应 body 带新 token。
 */

function readToken(record: Record<string, unknown>, snake: string, camel: string): string {
  const value = record[snake] ?? record[camel]
  return typeof value === 'string' ? value : ''
}

function normalizeSession(raw: unknown): LoginSession {
  const record = (raw ?? {}) as Record<string, unknown>
  const accessToken = readToken(record, 'x-jike-access-token', 'accessToken')
  const refreshToken = readToken(record, 'x-jike-refresh-token', 'refreshToken')

  const candidate = record.data ?? record.user
  const user = candidate && typeof candidate === 'object' ? unwrapData<UserProfile>(candidate) : null

  return { accessToken, refreshToken, user }
}

/** 发送短信验证码。返回上游 payload（含风控失败时的 success/toast），由 authStore 判定。 */
export const sendCodeAPI = (params: SendCodeParams) =>
  alova.Post<SendCodeResult>('/sendCode', params)

/** 验证码登录。返回归一化后的会话（token + 用户）。 */
export const loginAPI = (params: LoginParams) =>
  alova.Post<LoginResponse>('/login', params).then((raw) => normalizeSession(raw))

/** 刷新 token；失败会抛错（401/网络异常）。 */
export const refreshTokenAPI = (params: {
  'x-jike-access-token': string
  'x-jike-refresh-token': string
}) => alova.Post<Record<string, unknown>>('/refresh_token', params).then((raw) => normalizeSession(raw))

/** 拉取当前登录用户（干净对象，没有再包一层 data）。 */
export const profileAPI = () => alova.Post<unknown>('/profile').then((raw) => unwrapData<UserProfile>(raw))
