interface SkeletonBoxProps {
  className?: string
  style?: React.CSSProperties
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

const RADIUS: Record<NonNullable<SkeletonBoxProps['rounded']>, string> = {
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
}

export function SkeletonBox({ className = '', style, rounded = 'md' }: SkeletonBoxProps) {
  return <div className={`skeleton ${RADIUS[rounded]} ${className}`} style={style} />
}

/** 列表行骨架：形状贴近真实的行（封面 + 两行字 + 行尾值） */
export function EpisodeRowsSkeleton({ count = 4, cover = true }: { count?: number; cover?: boolean }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex gap-3.5 py-3.5 ${i > 0 ? 'dotted-top' : ''}`}
          style={{ paddingTop: i > 0 ? 16 : 14 }}
        >
          {cover && <SkeletonBox className="h-14 w-14 flex-shrink-0" rounded="md" />}
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <SkeletonBox className="h-[15px] w-[72%]" rounded="sm" />
            <SkeletonBox className="h-[12px] w-[44%]" rounded="sm" style={{ opacity: 0.7 }} />
          </div>
          <SkeletonBox className="h-[12px] w-10 flex-shrink-0" rounded="sm" />
        </div>
      ))}
    </div>
  )
}

/** 封面货架骨架 */
export function ShelfSkeleton({ count = 5, tileWidth = 156 }: { count?: number; tileWidth?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0" style={{ width: tileWidth }}>
          <SkeletonBox className="w-full" style={{ aspectRatio: '1' }} rounded="lg" />
          <SkeletonBox className="mt-2.5 h-[14px] w-[86%]" rounded="sm" />
          <SkeletonBox className="mt-1.5 h-[11px] w-[54%]" rounded="sm" style={{ opacity: 0.7 }} />
        </div>
      ))}
    </div>
  )
}

/** 详情页骨架：封面 + 标题 + 两行说明 */
export function DetailSkeleton() {
  return (
    <div>
      <div className="flex gap-5">
        <SkeletonBox className="h-[132px] w-[132px] flex-shrink-0" rounded="lg" />
        <div className="flex-1 space-y-3 pt-1">
          <SkeletonBox className="h-[26px] w-[52%]" rounded="sm" />
          <SkeletonBox className="h-[15px] w-[32%]" rounded="sm" style={{ opacity: 0.7 }} />
          <SkeletonBox className="h-[13px] w-[78%]" rounded="sm" style={{ opacity: 0.7 }} />
          <SkeletonBox className="mt-5 h-[38px] w-[132px]" rounded="full" />
        </div>
      </div>
      <div className="mt-10">
        <EpisodeRowsSkeleton count={5} cover={false} />
      </div>
    </div>
  )
}

export default SkeletonBox
