import { useId } from 'react'

interface BrandLogoProps {
  size?: number
  className?: string
  /** 白色圆底（App 图标式徽章）；关掉就只剩星球本体 */
  badge?: boolean
}

/**
 * 小宇宙品牌标记：白色圆底徽章 + 渐变蓝色星球 + 倾斜的深色行星环。
 * 行星环分两层：先画整圈（在星球后面），星球盖住中间，再把下半圈画在星球前面，
 * 得到「环从星球下方穿过」的前后关系。
 */
export default function BrandLogo({ size = 32, className = '', badge = true }: BrandLogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const planetId = `xyz-brand-planet-${uid}`
  const frontClipId = `xyz-brand-front-${uid}`

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className}>
      <defs>
        <linearGradient id={planetId} x1="32" y1="13" x2="32" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5CCBF4" />
          <stop offset="100%" stopColor="#1A8FCB" />
        </linearGradient>
        <clipPath id={frontClipId}>
          <rect x="0" y="32" width="64" height="32" />
        </clipPath>
      </defs>

      {badge && (
        <circle cx="32" cy="32" r="30.5" fill="#FFFFFF" stroke="rgba(20, 20, 20, 0.08)" strokeWidth="1" />
      )}

      {/* 后半圈：在星球下面 */}
      <g transform="rotate(-22 32 32)">
        <ellipse cx="32" cy="32" rx="27" ry="9" fill="none" stroke="#2A3038" strokeWidth="3.4" />
      </g>

      {/* 星球 */}
      <circle cx="32" cy="32" r="16.5" fill={`url(#${planetId})`} />

      {/* 前半圈：从星球下方穿过 */}
      <g transform="rotate(-22 32 32)" clipPath={`url(#${frontClipId})`}>
        <ellipse cx="32" cy="32" rx="27" ry="9" fill="none" stroke="#2A3038" strokeWidth="3.4" />
      </g>
    </svg>
  )
}
