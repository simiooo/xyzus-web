import { useEffect, useState, useRef } from 'react'
import { Typography, Button, Empty, Row, Col } from 'antd'
import { ReloadOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { discoveryAPI } from '@/api/discovery'
import useAuthStore from '@/stores/authStore'
import EpisodeCard from '@/components/EpisodeCard'
import HeroBanner from '@/components/HeroBanner'
import SectionHeader from '@/components/SectionHeader'
import type { DiscoveryRawSection, EpisodeBasic, EpisodeRecommendTarget, EditorPickItem, ImageUrls } from '@/api/types'

const { Text } = Typography

function UserCard() {
  const { user } = useAuthStore()
  if (!user) return null

  const genderLabel = user.gender === 'MALE' ? 'Male' : user.gender === 'FEMALE' ? 'Female' : null

  return (
    <div className="gradient-user-card rounded-xl mb-5 p-5">
      <div className="flex gap-4 items-center flex-wrap">
        <img
          src={user.avatar?.picture?.largePicUrl || user.avatar?.picture?.picUrl}
          alt=""
          className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0 border-2 border-white/30"
        />
        <div className="flex-1 min-w-0">
          <div className="text-[22px] font-bold text-white leading-tight">{user.nickname}</div>
          <div className="flex gap-2.5 mt-1 flex-wrap text-sm text-white/85">
            {user.ipLoc && <span>{user.ipLoc}</span>}
            {user.industry && <span>{user.industry}</span>}
            {user.birthYear && <span>{user.birthYear}</span>}
            {genderLabel && <span>{genderLabel === 'Male' ? '♂' : '♀'}</span>}
          </div>
          {user.bio && (
            <div className="mt-1.5 text-sm text-white/75 line-clamp-1">{user.bio}</div>
          )}
          {user.certifications && user.certifications.length > 0 && (
            <div className="mt-2 flex gap-1.5 flex-wrap">
              {user.certifications.map((cert, i) => (
                <span
                  key={i}
                  className="inline-block px-3 py-0.5 rounded-full text-white text-xs bg-white/20"
                >
                  {cert.kind === 'PODCASTER' ? 'Podcaster' : cert.kind}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NavHeaderBlock({ data }: { data: unknown }) {
  const items = data as {
    id: string
    leftImage?: { images: ImageUrls[]; style?: string }
    rightContent?: { text?: string; image?: ImageUrls; type: 'TEXT' | 'IMAGE' }
    url?: string
    backgroundImage?: ImageUrls
  }[]

  if (!items || items.length === 0) return null

  return (
    <div className="mb-5">
      <Row gutter={[10, 10]}>
        {items.map((item) => {
          const iconUrl = item.leftImage?.images?.[0]?.picUrl

          if (item.rightContent?.type === 'IMAGE') {
            return (
              <Col span={12} key={item.id}>
                <div className="rounded-lg overflow-hidden cursor-pointer relative h-20 bg-surface border border-subtle">
                  {item.rightContent.image?.picUrl && (
                    <>
                      <img
                        src={item.rightContent.image.picUrl}
                        alt=""
                        className="w-full h-full object-cover brightness-[0.65]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    </>
                  )}
                </div>
              </Col>
            )
          }

          return (
            <Col xs={12} sm={6} key={item.id}>
              <div className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg cursor-pointer transition-all duration-200 card-hover bg-surface border border-subtle">
                {iconUrl && (
                  <img src={iconUrl} alt="" className="w-7 h-7" />
                )}
                {item.rightContent?.text && (
                  <Text className="!text-primary" style={{ fontSize: 12 }}>{item.rightContent.text}</Text>
                )}
              </div>
            </Col>
          )
        })}
      </Row>
    </div>
  )
}

function EpisodeSectionBlock({ title, episodes }: { title: string; episodes: EpisodeBasic[] }) {
  if (!episodes || episodes.length === 0) return null

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateArrows = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  useEffect(() => {
    updateArrows()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows)
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [episodes])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = 280 + 12 // card width + gap
    el.scrollBy({ left: dir === 'left' ? -cardWidth : cardWidth, behavior: 'smooth' })
  }

  return (
    <div className="mb-6 relative group">
      <SectionHeader title={title} />
      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-all cursor-pointer"
          >
            <LeftOutlined style={{ fontSize: 12 }} />
          </button>
        )}
        <div ref={scrollRef} className="horizontal-scroll">
          {episodes.map((ep) => (
            <EpisodeCard key={ep.eid} episode={ep} />
          ))}
        </div>
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-all cursor-pointer"
          >
            <RightOutlined style={{ fontSize: 12 }} />
          </button>
        )}
      </div>
    </div>
  )
}

function SectionBlock({ section }: { section: DiscoveryRawSection }) {
  const { type, data } = section

  if (type === 'DISCOVERY_HEADER') {
    return <NavHeaderBlock data={data} />
  }

  if (type === 'DISCOVERY_COVER_BANNER') {
    const items = data as { id: string; image?: string; voiceover?: string; url?: string }[]
    return <HeroBanner items={items} />
  }

  if (type === 'DISCOVERY_EPISODE_RECOMMEND') {
    const d = data as {
      title?: string
      targetType?: string
      target?: EpisodeRecommendTarget[]
    }
    const episodes = d.target?.map((t) => t.episode).filter(Boolean) as EpisodeBasic[] | undefined
    if (!episodes || episodes.length === 0) return null
    return <EpisodeSectionBlock title={d.title || ''} episodes={episodes} />
  }

  if (type === 'EDITOR_PICK') {
    const d = data as { picks?: EditorPickItem[] }
    const episodes = d.picks?.map((p) => p.episode).filter(Boolean) as EpisodeBasic[] | undefined
    if (!episodes || episodes.length === 0) return null
    return <EpisodeSectionBlock title="Editor's Picks" episodes={episodes} />
  }

  return null
}

export default function Home() {
  const [sections, setSections] = useState<DiscoveryRawSection[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [loadMoreKey, setLoadMoreKey] = useState<string | undefined>()
  const genRef = useRef(0)

  const loadAll = () => {
    const gen = ++genRef.current
    setLoading(true)
    setError(false)

    discoveryAPI()
      .then((result) => {
        if (gen === genRef.current) {
          const rawSections = result.data
          if (!rawSections || rawSections.length === 0) {
            setError(true)
          } else {
            setSections(rawSections)
            setLoadMoreKey(result.loadMoreKey)
          }
        }
      })
      .catch(() => {
        if (gen === genRef.current) setError(true)
      })
      .finally(() => {
        if (gen === genRef.current) setLoading(false)
      })
  }

  const loadMore = () => {
    if (!loadMoreKey || loadingMore) return
    setLoadingMore(true)
    const gen = genRef.current

    discoveryAPI({ loadMoreKey })
      .then((result) => {
        if (gen === genRef.current) {
          const newSections = result.data
          if (newSections && newSections.length > 0) {
            setSections((prev) => [...prev, ...newSections])
          }
          setLoadMoreKey(result.loadMoreKey)
        }
      })
      .catch(() => {
        if (gen === genRef.current) setLoadMoreKey(undefined)
      })
      .finally(() => {
        if (gen === genRef.current) setLoadingMore(false)
      })
  }

  useEffect(() => {
    loadAll()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer rounded-xl h-48" />
        <div className="shimmer rounded-xl h-20" />
        <div className="shimmer rounded-xl h-32" />
        <div className="shimmer rounded-xl h-32" />
      </div>
    )
  }

  if (error || sections.length === 0) {
    return (
      <div>
        <UserCard />
        <div className="bg-surface rounded-lg border border-subtle text-center py-10">
          <Empty description={<span className="text-secondary">Unable to load content</span>} />
          <Button type="primary" icon={<ReloadOutlined />} onClick={loadAll} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <UserCard />
      {sections.map((section, idx) => (
        <SectionBlock key={idx} section={section} />
      ))}
      <div className="text-center py-4 pb-8">
        {loadingMore ? (
          <Button loading className="rounded-full">Loading...</Button>
        ) : loadMoreKey ? (
          <Button onClick={loadMore} className="rounded-full px-8" type="default">
            Load More
          </Button>
        ) : sections.length > 0 ? (
          <Text className="!text-tertiary" style={{ fontSize: 12 }}>— Loaded all content —</Text>
        ) : null}
      </div>
    </div>
  )
}
