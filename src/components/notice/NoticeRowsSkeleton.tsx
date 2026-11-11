import { SkeletonBox } from '@/components/ui/Skeleton'

interface NoticeRowsSkeletonProps {
  count?: number
}

/**
 * 通知列表的加载骨架：形状贴近真实行（40 头像 + 两行字 + 行尾时间），
 * 第一行没有点线，其余行带点线，和真实列表的间距一致。
 */
export default function NoticeRowsSkeleton({ count = 6 }: NoticeRowsSkeletonProps) {
  return (
    <div aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`flex items-center gap-4 py-3.5 ${index > 0 ? 'dotted-top' : ''}`}
        >
          <SkeletonBox className="h-10 w-10 flex-shrink-0" rounded="full" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBox className="h-[14px] w-[56%]" rounded="sm" />
            <SkeletonBox
              className="h-[12px] w-[82%]"
              rounded="sm"
              style={{ opacity: 0.7 }}
            />
          </div>
          <SkeletonBox className="h-[12px] w-12 flex-shrink-0" rounded="sm" />
        </div>
      ))}
    </div>
  )
}
