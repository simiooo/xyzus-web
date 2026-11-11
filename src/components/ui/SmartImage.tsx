import { useEffect, useMemo, useRef, useState } from 'react'
import type { ImageUrls } from '@/api/types'

type ImageSource = ImageUrls | string | null | undefined

type Phase = 'empty' | 'thumb' | 'full' | 'failed'

interface SmartImageProps {
  /** 接口给的多尺寸图片对象，或一个普通 URL */
  image?: ImageSource
  alt?: string
  /** 外层容器的类名：负责定位、尺寸与网格位置 */
  className?: string
  /** 图片本身的类名：负责 object-fit 等 */
  imgClassName?: string
  /** 宽高比，用来在图片到达前把位置占住，避免跳动 */
  aspectRatio?: number | string
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** 首屏关键图（封面、正在播放）直接取大图，其余懒加载 */
  priority?: boolean
  /** 占位底的色阶；`none` 用于透明底的分层素材（如活动位的文字图、图标），不画占位底 */
  tone?: 'muted' | 'sunken' | 'none'
  onPhaseChange?: (phase: Phase) => void
}

const RADIUS: Record<NonNullable<SmartImageProps['rounded']>, string> = {
  none: '',
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
}

function pickThumb(image: ImageSource): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  // 过渡用「小图」而不是最小缩略图：32px 的缩略图放大到卡片尺寸会糊成一片，
  // smallPicUrl（64–160px）在视觉效果和体积之间更平衡。
  return (
    image.smallPicUrl ||
    image.thumbnailUrl ||
    image.middlePicUrl ||
    image.picUrl ||
    null
  )
}

function pickFull(image: ImageSource): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  return (
    image.largePicUrl ||
    image.picUrl ||
    image.middlePicUrl ||
    image.smallPicUrl ||
    null
  )
}

/**
 * 图片渐进加载：先给一块占位的空状态，缩略图到了先显示缩略图，
 * 大图到了再淡入盖上去。任何一步失败都退回上一步，不会出现裂图。
 */
export default function SmartImage({
  image,
  alt = '',
  className = '',
  imgClassName = '',
  aspectRatio = 1,
  rounded = 'md',
  priority = false,
  tone = 'muted',
  onPhaseChange,
}: SmartImageProps) {
  const thumb = useMemo(() => pickThumb(image), [image])
  const full = useMemo(() => pickFull(image), [image])

  const [thumbLoaded, setThumbLoaded] = useState(false)
  const [thumbFailed, setThumbFailed] = useState(false)
  const [fullLoaded, setFullLoaded] = useState(false)
  const [fullFailed, setFullFailed] = useState(false)
  // 图片请求偶发失败（CDN 限流/网络抖动/防盗链）时自动重试，最多两次、逐步退避
  const retryCountRef = useRef(0)
  const [retryTick, setRetryTick] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const lastKeyRef = useRef<string>('')

  // 图像来源变了：立刻回到空状态，避免旧图闪在新内容上
  const key = `${thumb ?? ''}|${full ?? ''}`
  useEffect(() => {
    if (lastKeyRef.current === key) return
    lastKeyRef.current = key
    setThumbLoaded(false)
    setThumbFailed(false)
    setFullLoaded(false)
    setFullFailed(false)
    retryCountRef.current = 0
    setRetryTick(0)
  }, [key])

  /** 请求失败时最多重试两次；仍失败才落回占位 */
  const handleError = (markFailed: (value: boolean) => void) => {
    const attempt = retryCountRef.current
    if (attempt < 2) {
      retryCountRef.current = attempt + 1
      window.setTimeout(() => setRetryTick((value) => value + 1), attempt === 0 ? 600 : 1800)
      return
    }
    markFailed(true)
  }

  // 图片可能在 React 绑定 onLoad 之前就已命中缓存，此时 load 事件不会再触发；
  // 挂载后检查一次 naturalWidth，避免永远停在占位状态。
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const imgs = containerRef.current?.querySelectorAll('img') ?? []
      imgs.forEach((img) => {
        if (!img.complete || img.naturalWidth === 0) return
        if (img.src === thumb) setThumbLoaded(true)
        if (img.src === full) setFullLoaded(true)
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [thumb, full, retryTick])

  const usableThumb = thumb && !thumbFailed ? thumb : null
  const usableFull = full && !fullFailed && full !== usableThumb ? full : null

  const phase: Phase = useMemo(() => {
    if (fullLoaded && usableFull) return 'full'
    if (thumbLoaded && usableThumb) return 'thumb'
    if (!usableThumb && !usableFull) return 'failed'
    return 'empty'
  }, [fullLoaded, usableFull, thumbLoaded, usableThumb])

  useEffect(() => {
    onPhaseChange?.(phase)
  }, [phase, onPhaseChange])

  const ratio = typeof aspectRatio === 'number' ? `${aspectRatio}` : aspectRatio

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${RADIUS[rounded]} ${className}`}
      style={{
        aspectRatio: ratio,
        backgroundColor:
          tone === 'none' ? 'transparent' : tone === 'sunken' ? 'var(--sunken)' : 'var(--muted)',
      }}
      data-phase={phase}
    >
      {/* 空状态：位置先占住，只有一个极淡的音频标记，不放插图（透明底素材不显示占位） */}
      {phase !== 'full' && tone !== 'none' && (
        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
          aria-hidden
        >
          <CoverGlyph faded={phase === 'thumb'} />
        </div>
      )}

      {/* 缩略图：先到先显示，像素少所以轻微模糊，避免锯齿 */}
      {usableThumb && (
        <img
          key={`thumb-${retryTick}`}
          src={usableThumb}
          alt=""
          aria-hidden
          decoding="async"
          referrerPolicy="no-referrer"
          loading={priority ? 'eager' : 'lazy'}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${imgClassName}`}
          style={{
            opacity: thumbLoaded && !fullLoaded ? 1 : 0,
            // 大图到位前用轻微模糊遮住放大后的锯齿；没有更大的图、或大图确认失败时
            // 恢复正常显示 —— 不能永远停在模糊状态。
            filter: !usableFull || fullFailed ? 'none' : 'blur(2px)',
            transform: !usableFull || fullFailed ? undefined : 'scale(1.02)',
          }}
          onLoad={() => setThumbLoaded(true)}
          onError={() => handleError(setThumbFailed)}
        />
      )}

      {/* 大图：加载好后淡入，缩略图留在下面直到大图完全就位 */}
      {usableFull && (
        <img
          key={`full-${retryTick}`}
          src={usableFull}
          alt={alt}
          decoding="async"
          referrerPolicy="no-referrer"
          loading={priority ? 'eager' : 'lazy'}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-smooth ${imgClassName}`}
          style={{ opacity: fullLoaded ? 1 : 0 }}
          onLoad={() => setFullLoaded(true)}
          onError={() => {
            handleError((failed) => {
              setFullFailed(failed)
              if (!usableThumb) setThumbFailed(failed)
            })
          }}
        />
      )}
    </div>
  )
}

/** 极简音频标记：三条竖线，占位图里唯一的图形 */
function CoverGlyph({ faded }: { faded: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden
      style={{
        opacity: faded ? 0 : 1,
        transition: 'opacity 240ms ease',
      }}
    >
      <rect x="3.5" y="8" width="2" height="6" rx="1" fill="var(--hairline)" />
      <rect x="10" y="5" width="2" height="12" rx="1" fill="var(--hairline)" />
      <rect x="16.5" y="9" width="2" height="4" rx="1" fill="var(--hairline)" />
    </svg>
  )
}
