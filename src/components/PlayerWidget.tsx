import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Typography, Slider, Button } from 'antd'
import { CaretRightOutlined, PauseOutlined } from '@ant-design/icons'
import useAudioStore from '@/stores/audioStore'
import { formatDurationShort } from '@/utils/format'

const { Text } = Typography

function useWaveformBars(count = 40) {
  return useMemo(() => {
    const seed = 42
    const bars: number[] = []
    for (let i = 0; i < count; i++) {
      bars.push(((seed * (i + 1) * 7 + 13) % 20) + 4)
    }
    return bars
  }, [count])
}

export default function PlayerWidget() {
  const navigate = useNavigate()
  const { currentEpisode, isPlaying, currentTime, duration, togglePlay, _setCurrentTime } = useAudioStore()
  const bars = useWaveformBars()

  if (!currentEpisode) {
    return (
      <div className="bg-surface rounded-xl border border-subtle p-5 text-center">
        <div className="w-20 h-20 rounded-xl bg-surface-elevated mx-auto mb-4 flex items-center justify-center">
          <CaretRightOutlined style={{ fontSize: 32, color: 'rgba(255,255,255,0.25)' }} />
        </div>
        <Text className="!text-secondary block text-sm">No episode playing</Text>
        <Text className="!text-tertiary block text-xs mt-1">Browse and play an episode</Text>
      </div>
    )
  }

  const coverUrl = currentEpisode.image?.picUrl || currentEpisode.podcast?.image?.picUrl
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const playedCount = Math.floor((progress / 100) * bars.length)

  return (
    <div className="bg-surface rounded-xl border border-subtle overflow-hidden">
      <div className="p-5">
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            className="w-full aspect-square rounded-lg object-cover mb-4 cursor-pointer"
            onClick={() => navigate(`/episode/${currentEpisode.eid}`)}
          />
        )}
        <Text
          className="!text-primary block text-sm font-semibold cursor-pointer hover:!text-accent-primary transition-colors line-clamp-1"
          onClick={() => navigate(`/episode/${currentEpisode.eid}`)}
        >
          {currentEpisode.title}
        </Text>
        {currentEpisode.podcast?.title && (
          <Text className="!text-tertiary block text-xs mt-0.5 line-clamp-1">
            {currentEpisode.podcast.title}
          </Text>
        )}
      </div>

      <div className="px-5">
        <div className="flex items-end justify-between h-14 gap-[2px] mb-3">
          {bars.map((height, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full transition-colors duration-300"
              style={{
                height: `${height}px`,
                background: i < playedCount ? '#FF7A45' : 'rgba(255,255,255,0.10)',
              }}
            />
          ))}
        </div>

        <Slider
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(val) => _setCurrentTime(val)}
          tooltip={{ formatter: (v) => formatDurationShort(v || 0) }}
          className="mb-1"
        />

        <div className="flex justify-between mb-4">
          <Text className="!text-tertiary" style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
            {formatDurationShort(currentTime)}
          </Text>
          <Text className="!text-tertiary" style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
            {formatDurationShort(duration)}
          </Text>
        </div>
      </div>

      <div className="px-5 pb-5 flex items-center justify-center gap-4">
        <Button
          type="text"
          icon={isPlaying ? <PauseOutlined /> : <CaretRightOutlined />}
          onClick={togglePlay}
          className="!w-14 !h-14 !flex !items-center !justify-center rounded-full !bg-accent-primary !text-white !border-none hover:!bg-accent-primary-hover active:scale-95 transition-all"
          style={{
            boxShadow: isPlaying ? '0 0 20px rgba(255,122,69,0.30)' : 'none',
          }}
        />
      </div>
    </div>
  )
}
