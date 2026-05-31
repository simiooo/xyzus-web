import alova from '@/alova'
import type { UserProfile, PickRecentParams } from '@/api/types'

export const getProfileAPI = () =>
  alova.Post<UserProfile>('/profile')

export const pickRecentAPI = (params: PickRecentParams) =>
  alova.Post<unknown[]>('/pick_recent', params)
