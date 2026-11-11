import { SkeletonBox, EpisodeRowsSkeleton } from '@/components/ui/Skeleton'

/**
 * 启动校验（AuthGuard loading）时的骨架。
 * 直接照三列外壳的骨架来画：左栏 logo + 导航、中间页头 + 专题图 + 信息流、右栏搜索 + 分组。
 * 这样校验完成进入 Layout 时，栏目位置与首屏骨架一致，不会整页重排。
 */
export default function ShellSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)]" aria-busy="true">
      <aside className="hidden w-[var(--rail)] shrink-0 px-6 pt-4 lg:block">
        <SkeletonBox className="h-[42px] w-[42px]" rounded="full" />
        <div className="mt-10 flex flex-col gap-4">
          {[56, 56, 56, 56, 56].map((width, index) => (
            <div key={index} className="flex items-center gap-3">
              <SkeletonBox className="h-5 w-5" rounded="sm" />
              <SkeletonBox className="h-[17px]" rounded="sm" style={{ width }} />
            </div>
          ))}
        </div>
      </aside>

      <div className="min-w-0 flex-1 px-4 pb-24 pt-3 lg:px-5 lg:pt-4">
        <div className="mb-5 flex items-end justify-between px-1">
          <div>
            <SkeletonBox className="h-[30px] w-[104px]" rounded="sm" />
            <SkeletonBox className="mt-2 h-[13px] w-[208px]" rounded="sm" />
          </div>
          <SkeletonBox className="h-[15px] w-[56px]" rounded="sm" />
        </div>
        <SkeletonBox className="w-full" style={{ aspectRatio: 2.2 }} rounded="lg" />
        <SkeletonBox className="mt-2 h-[21px] w-[62%]" rounded="sm" />
        {[3, 4].map((count, index) => (
          <div key={index} className="mt-8">
            <SkeletonBox className="mb-2 h-[21px] w-[140px]" rounded="sm" />
            <EpisodeRowsSkeleton count={count} />
          </div>
        ))}
      </div>

      <aside className="hidden w-[var(--right-w)] shrink-0 xl:block">
        <div className="px-6 py-5">
          <SkeletonBox className="h-9 w-full" rounded="full" />
          {[0, 1, 2].map((index) => (
            <div key={index} className="mt-5">
              <SkeletonBox className="mb-2 h-[15px] w-[64px]" rounded="sm" />
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center gap-3">
                    <SkeletonBox className="h-10 w-10 shrink-0" rounded="md" />
                    <SkeletonBox className="h-[15px] flex-1" rounded="sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
