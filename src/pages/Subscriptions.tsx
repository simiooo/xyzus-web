import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Typography, Empty, Button } from 'antd'
import { InboxOutlined, ReloadOutlined } from '@ant-design/icons'
import { subscriptionListAPI, type SubscriptionLoadMoreKey } from '@/api/subscription'
import useAuthStore from '@/stores/authStore'
import { formatDate } from '@/utils/format'
import type { PodcastBasic } from '@/api/types'

const { Title, Text } = Typography

export default function Subscriptions() {
  const navigate = useNavigate()
  const { uid: urlUid } = useParams<{ uid?: string }>()
  const { user } = useAuthStore()

  const targetUid = urlUid || user?.uid

  const [podcasts, setPodcasts] = useState<PodcastBasic[]>([])
  const [loadMoreKey, setLoadMoreKey] = useState<SubscriptionLoadMoreKey | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchList = (key?: SubscriptionLoadMoreKey, append = false) => {
    const isInitial = !key
    if (isInitial) setLoading(true)
    else setLoadingMore(true)

    const params: { uid?: string; loadMoreKey?: SubscriptionLoadMoreKey } = {}
    if (targetUid) params.uid = targetUid
    if (key) params.loadMoreKey = key

    subscriptionListAPI(params)
      .then((res) => {
        const items = res.data || []
        setPodcasts((prev) => (append ? [...prev, ...items] : items))
        setLoadMoreKey(res.loadMoreKey)
      })
      .catch(() => {
        if (!append) setPodcasts([])
      })
      .finally(() => {
        setLoading(false)
        setLoadingMore(false)
      })
  }

  useEffect(() => {
    fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUid])

  const handleLoadMore = () => {
    if (loadMoreKey) fetchList(loadMoreKey, true)
  }

  if (loading) {
    const title = urlUid ? `${urlUid}'s Subscriptions` : 'My Subscriptions'
    return (
      <div>
        <Title level={4} className="!text-primary mb-4">{title}</Title>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="shimmer rounded-lg aspect-[3/4]" />
          ))}
        </div>
      </div>
    )
  }

  if (podcasts.length === 0) {
    const emptyText = urlUid ? 'This user has no public subscriptions' : 'No subscriptions yet'
    const emptySubText = urlUid ? '' : 'Explore categories or search to find podcasts you love'

    return (
      <div className="py-16">
        <Empty
          description={<span className="text-secondary">{emptyText}</span>}
        >
          <InboxOutlined className="text-5xl text-tertiary mb-4 block" />
          {emptySubText && (
            <span className="text-tertiary text-xs block mb-4">{emptySubText}</span>
          )}
          {!urlUid && (
            <Button type="primary" onClick={() => navigate('/categories')}>
              Browse Categories
            </Button>
          )}
        </Empty>
      </div>
    )
  }

  const title = urlUid ? `${urlUid}'s Subscriptions` : 'My Subscriptions'

    return (
      <div>
        <Title level={4} className="!text-primary mb-1">{title}</Title>
      <Text className="!text-tertiary text-sm mb-4 block">{podcasts.length} podcasts</Text>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {podcasts.map((podcast) => (
          <div
            key={podcast.pid}
            className="cursor-pointer card-hover group"
            onClick={() => navigate(`/podcast/${podcast.pid}`)}
          >
            <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2">
              {podcast.image?.picUrl ? (
                <img
                  src={podcast.image.picUrl}
                  alt={podcast.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-surface-elevated" />
              )}
              {podcast.subscriptionStar && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent-primary flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
              )}
            </div>
            <Text className="!text-primary block text-sm font-semibold truncate" title={podcast.title}>
              {podcast.title}
            </Text>
            <Text className="!text-tertiary block text-xs truncate" title={podcast.author}>
              {podcast.author}
            </Text>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <Text className="!text-quaternary">{podcast.episodeCount} eps</Text>
              {podcast.latestEpisodePubDate && (
                <Text className="!text-quaternary">{formatDate(podcast.latestEpisodePubDate)}</Text>
              )}
            </div>
          </div>
        ))}
      </div>

      {loadMoreKey && (
        <div className="flex justify-center mt-8 mb-4">
          <Button
            type="default"
            icon={<ReloadOutlined />}
            loading={loadingMore}
            onClick={handleLoadMore}
            className="border-subtle text-secondary hover:!text-primary hover:border-secondary"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}