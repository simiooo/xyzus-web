import alova from '@/alova'
import type {
  SendCodeParams,
  LoginParams,
  LoginResponse,
  UserProfile,
} from '@/api/types'

export const sendCodeAPI = (params: SendCodeParams) =>
  alova.Post<null>('/sendCode', params)

export const loginAPI = (params: LoginParams) =>
  alova.Post<LoginResponse>('/login', params)

export const refreshTokenAPI = (params: {
  'x-jike-access-token': string
  'x-jike-refresh-token': string
}) =>
  alova.Post<LoginResponse>('/refresh_token', params)

export const profileAPI = () =>
  alova.Post<UserProfile>('/profile')
