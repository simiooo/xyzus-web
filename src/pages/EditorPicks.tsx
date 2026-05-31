import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Typography, Empty, Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { editorPickListHistoryAPI } from '@/api/discovery'
import { formatDate } from '@/utils/format'

const { Title, Text } = Typography

interface EditorPickItem {
  date: string
  picks: {
    episode: {
      eid: string
      title: string
      description?: string
      image?: { picUrl?: string }
      podcast?: { title?: string; pid?: string }
    }
    comment?: string
  }[]
}

export default function EditorPicks() {
  const navigate = useNavigate()
  const [picks, setPicks] = useState<EditorPickItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    editorPickListHistoryAPI()
      .then((data) => setPicks((data || []) as EditorPickItem[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="mb-3">
          Back
        </Button>
        <Title level={4} className="!text-primary mb-4">Editor Picks</Title>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer rounded-lg h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="mb-3">
        Back
      </Button>

      <Title level={4} className="!text-primary mb-4">Editor Picks</Title>

      {picks.length === 0 ? (
        <Empty description={<span className="text-secondary">No editor picks yet</span>} className="py-16" />
      ) : (
        <div className="space-y-3">
          {picks.map((pick) => (
            <div key={pick.date} className="bg-surface rounded-lg border border-subtle p-4">
              <Text strong className="!text-primary" style={{ fontSize: 16 }}>
                {formatDate(pick.date, { year: 'numeric', month: 'short', day: 'numeric' })}
              </Text>
              <div className="mt-3">
                {pick.picks?.length > 0 ? pick.picks.map((p, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 py-2 cursor-pointer rounded-lg list-hover px-2 ${i > 0 ? 'border-t border-border-subtle' : ''}`}
                    onClick={() => navigate(`/episode/${p.episode?.eid}`)}
                  >
                    {p.episode?.image?.picUrl && (
                      <img
                        src={p.episode.image.picUrl}
                        alt=""
                        className="w-[60px] h-[60px] rounded-md object-cover flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <Text className="!text-primary" style={{ fontSize: 14 }} ellipsis={{ tooltip: p.episode?.title }}>
                        {p.episode?.title}
                      </Text>
                      <div className="mt-0.5">
                        <Text className="!text-tertiary" style={{ fontSize: 12 }}>{p.episode?.podcast?.title}</Text>
                      </div>
                      {p.comment && (
                        <Text className="!text-tertiary block mt-1" style={{ fontSize: 12 }} ellipsis>
                          Editor's note: {p.comment}
                        </Text>
                      )}
                    </div>
                  </div>
                )) : (
                  <Text className="!text-tertiary" style={{ fontSize: 12 }}>No picks for this date</Text>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
