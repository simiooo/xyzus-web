import { useNavigate } from 'react-router'
import { Typography, Button } from 'antd'
import { CaretRightOutlined, PauseOutlined, CloseOutlined } from '@ant-design/icons'
import useAudioStore from '@/stores/audioStore'
import { formatDurationShort } from '@/utils/format'

const { Text } = Typography

export default function MiniPlayer() {
  const navigate = useNavigate()
  const { currentEpisode, isPlaying, currentTime, duration, togglePlay, stop } = useAudioStore()

  if (!currentEpisode) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const coverUrl = currentEpisode.image?.picUrl || currentEpisode.podcast?.image?.picUrl

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-subtle shadow-md">
      <div className="w-full h-[3px] bg-border-subtle">
        <div
          className="h-full bg-accent-primary transition-all duration-200 ease-linear rounded-r-full"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center gap-3 px-4 h-[60px]">
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            className="w-11 h-11 rounded-md object-cover flex-shrink-0 cursor-pointer"
            onClick={() => navigate(`/episode/${currentEpisode.eid}`)}
          />
        )}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => navigate(`/episode/${currentEpisode.eid}`)}
        >
          <Text className="!text-primary" style={{ fontSize: 13, lineHeight: '18px', display: 'block' }} ellipsis>
            {currentEpisode.title}
          </Text>
          {currentEpisode.podcast?.title && (
            <Text className="!text-tertiary" style={{ fontSize: 11, lineHeight: '16px', display: 'block' }} ellipsis>
              {currentEpisode.podcast.title}
            </Text>
          )}
        </div>
        <Text className="!text-tertiary flex-shrink-0" style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
          {formatDurationShort(currentTime)} / {formatDurationShort(duration)}
        </Text>
        <Button
          type="text"
          icon={isPlaying ? <PauseOutlined /> : <CaretRightOutlined />}
          onClick={togglePlay}
          size="small"
          className="flex-shrink-0 !text-primary"
        />
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={stop}
          size="small"
          className="flex-shrink-0 !text-tertiary"
        />
      </div>
    </div>
  )
}
