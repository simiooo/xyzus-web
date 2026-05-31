import alova from '@/alova'
import type { PodcastBasic } from '@/api/types'

export interface SubscriptionLoadMoreKey {
  skip: number
}

export interface SubscriptionParams {
  uid?: string
  loadMoreKey?: SubscriptionLoadMoreKey
}

export const subscriptionListAPI = (params?: SubscriptionParams) =>
  alova.Post<{
    data: PodcastBasic[]
    loadMoreKey?: SubscriptionLoadMoreKey
  }>('/subscription', params || {})

export const subscriptionUpdateAPI = (pid: string, mode: 'ON' | 'OFF') =>
  alova.Post<PodcastBasic>('/subscription_update', { pid, mode })