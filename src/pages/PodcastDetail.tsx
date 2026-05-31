import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  Card, Typography, Button, List, Skeleton, Select, Tag, Empty,
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { podcastDetailAPI, episodeListAPI, podcastRelatedAPI } from '@/api/podcast'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { formatDate, formatDuration } from '@/utils/format'
import PodcastCard from '@/components/PodcastCard'
import type { PodcastBasic, EpisodeBasic, CursorKey } from '@/api/types'

const { Title, Text, Paragraph } = Typography

export default function PodcastDetail() {
  const { pid } = useParams<{ pid: string }>()
  const navigate = useNavigate()

  const [podcast, setPodcast] = useState<PodcastBasic | null>(null)
  const [related, setRelated] = useState<PodcastBasic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [episodes, setEpisodes] = useState<EpisodeBasic[]>([])
  const [episodesLoading, setEpisodesLoading] = useState(false)
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [loadMoreKey, setLoadMoreKey] = useState<CursorKey | undefined>()
  const [episodeHasMore, setEpisodeHasMore] = useState(true)

  useEffect(() => {
    if (!pid) { setError('Podcast ID is missing'); setLoading(false); return }
    const pidVal = pid
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [podcastResult, relatedResult] = await Promise.all([
          podcastDetailAPI(pidVal),
          podcastRelatedAPI({ pid: pidVal }),
        ])
        if (!cancelled) {
          setPodcast(podcastResult.data)
          setRelated(relatedResult.data.map((r) => r.podcast))
        }
      } catch {
        if (!cancelled) setError('Failed to load podcast')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [pid])

  useEffect(() => {
    if (!pid) return
    const pidVal = pid
    let cancelled = false

    async function load() {
      setEpisodesLoading(true)
      setLoadMoreKey(undefined)
      setEpisodeHasMore(true)
      try {
        const result = await episodeListAPI({ pid: pidVal, order })
        if (!cancelled) {
          setEpisodes(result.data || [])
          setLoadMoreKey(result.loadMoreKey)
          setEpisodeHasMore(!!result.loadMoreKey)
        }
      } catch {
        // handled by alova
      } finally {
        if (!cancelled) setEpisodesLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [pid, order])

  const loadMoreEpisodes = useCallback(async () => {
    if (!pid || !loadMoreKey) return
    try {
      const result = await episodeListAPI({ pid, order, loadMoreKey })
      setEpisodes((prev) => [...prev, ...(result.data || [])])
      setLoadMoreKey(result.loadMoreKey)
      setEpisodeHasMore(!!result.loadMoreKey)
    } catch {
      // handled by alova
    }
  }, [pid, order, loadMoreKey])

  const sentinelRef = useInfiniteScroll(loadMoreEpisodes, { enabled: episodeHasMore && !episodesLoading })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer rounded-xl h-48" />
        <div className="shimmer rounded-xl h-32" />
      </div>
    )
  }

  if (error || !podcast) {
    return (
      <div className="text-center py-16">
        <Empty description={error || 'Podcast not found'} />
        <Button type="primary" onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
      </div>
    )
  }

  const coverUrl = podcast.image?.largePicUrl || podcast.image?.picUrl

  return (
    <div>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="mb-3">
        Back
      </Button>

      <Card bordered={false} className="bg-surface rounded-lg border border-subtle mb-4">
        <div className="flex gap-4 flex-wrap">
          {coverUrl && (
            <img
              src={coverUrl}
              alt=""
              className="w-[180px] h-[180px] rounded-lg object-cover flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="flex-1 min-w-[200px]">
            <Title level={3} className="!text-primary" style={{ marginBottom: 4 }}>{podcast.title}</Title>
            <Text className="!text-secondary" style={{ fontSize: 15 }}>{podcast.author}</Text>
            <div className="mt-2 flex gap-2 flex-wrap">
              {podcast.topicLabels?.slice(0, 3).map((label) => (
                <Tag key={label} className="!rounded-full">{label}</Tag>
              ))}
            </div>
            <div className="mt-3">
              <Text strong className="!text-primary">{podcast.subscriptionCount.toLocaleString()}</Text>
              <Text className="!text-secondary"> subscribers</Text>
              <Text className="!text-secondary" style={{ marginLeft: 16 }}>
                <Text strong className="!text-primary">{podcast.episodeCount}</Text> episodes
              </Text>
            </div>
            {podcast.brief && (
              <Paragraph className="!text-secondary mt-2" style={{ fontSize: 13 }} ellipsis={{ rows: 2 }}>
                {podcast.brief}
              </Paragraph>
            )}
          </div>
        </div>

        {podcast.description && (
          <div className="mt-4">
            <Text strong className="!text-primary">About</Text>
            <Paragraph className="!text-secondary mt-1" style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {podcast.description}
            </Paragraph>
          </div>
        )}
      </Card>

      {related.length > 0 && (
        <div className="mb-4">
          <Title level={5} className="!text-primary !m-0 mb-3">Related Podcasts</Title>
          <div className="horizontal-scroll">
            {related.map((item) => (
              <PodcastCard key={item.pid} podcast={item} />
            ))}
          </div>
        </div>
      )}

      <Card bordered={false} className="bg-surface rounded-lg border border-subtle">
        <div className="flex justify-between items-center mb-4">
          <Title level={5} className="!text-primary !m-0">Episodes</Title>
          <Select value={order} onChange={setOrder} size="small" style={{ width: 120 }}
            className="!bg-surface"
          >
            <Select.Option value="desc">Newest first</Select.Option>
            <Select.Option value="asc">Oldest first</Select.Option>
          </Select>
        </div>

        {episodesLoading && episodes.length === 0 ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : episodes.length === 0 ? (
          <Empty description={<span className="text-secondary">No episodes</span>} />
        ) : (
          <>
            <List
              dataSource={episodes}
              renderItem={(ep) => {
                const epCover = ep.image?.picUrl || podcast.image?.picUrl
                return (
                  <List.Item
                    onClick={() => navigate(`/episode/${ep.eid}`)}
                    className="cursor-pointer !py-3 list-hover !px-0"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex gap-3 w-full">
                      {epCover ? (
                        <img
                          src={epCover}
                          alt=""
                          className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-md bg-surface-elevated flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <Text className="!text-primary" style={{ fontSize: 14 }} ellipsis={{ tooltip: ep.title }}>
                          {ep.title}
                        </Text>
                        <div className="mt-1 flex gap-3 text-xs">
                          <Text className="!text-tertiary">{formatDate(ep.pubDate, { year: 'numeric' })}</Text>
                          {ep.duration > 0 && (
                            <Text className="!text-tertiary">{formatDuration(ep.duration)}</Text>
                          )}
                        </div>
                        <Paragraph
                          className="!text-tertiary mt-1 !mb-0"
                          style={{ fontSize: 12 }}
                          ellipsis={{ rows: 1 }}
                        >
                          {ep.description}
                        </Paragraph>
                      </div>
                    </div>
                  </List.Item>
                )
              }}
            />
            {episodeHasMore && <div ref={sentinelRef} className="h-[1px]" />}
          </>
        )}
      </Card>
    </div>
  )
}
