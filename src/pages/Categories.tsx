import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { categoryListAPI, type CategoryInfo } from '@/api/category'
import PageHeader from '@/components/ui/PageHeader'
import SmartImage from '@/components/ui/SmartImage'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonBox } from '@/components/ui/Skeleton'

/** 分类行用统一的网格排布：一列到四列，行本身不带卡片底色 */
const GRID_CLASS = 'grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3'

function CategoryGlyph({ category }: { category: CategoryInfo }) {
  if (category.emoji) {
    return (
      <span
        aria-hidden
        className="w-7 flex-shrink-0 select-none text-center"
        style={{ fontSize: 20, lineHeight: 1 }}
      >
        {category.emoji}
      </span>
    )
  }

  return (
    <SmartImage
      image={category.icon}
      aspectRatio={1}
      rounded="md"
      className="h-7 w-7 flex-shrink-0"
      alt={category.name}
    />
  )
}

function LoadError({ hint, onRetry }: { hint: string; onRetry: () => void }) {
  return (
    <div className="py-12">
      <p className="m-0 type-title text-[var(--ink)]">没能加载出来</p>
      <p className="m-0 mt-2 max-w-[420px] type-sub">{hint}</p>
      <button type="button" onClick={onRetry} className="pill pill-ink mt-5">
        重试
      </button>
    </div>
  )
}

export default function Categories() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    categoryListAPI()
      .then((items) => {
        if (cancelled) return
        setCategories(Array.isArray(items) ? items : [])
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setCategories([])
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const retry = () => {
    setError(false)
    setLoading(true)
    setReloadToken((token) => token + 1)
  }

  return (
    <div>
      <PageHeader
        title="分类"
        aside={categories.length > 0 ? `${categories.length} 个分类` : undefined}
        description="按主题浏览播客，找到想听的声音。"
        size="display"
      />

      {loading ? (
        <div className={GRID_CLASS} aria-busy="true">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-2.5 py-3.5">
              <SkeletonBox className="h-7 w-7 flex-shrink-0" rounded="full" />
              <SkeletonBox className="h-[15px] w-[62%]" rounded="sm" />
            </div>
          ))}
        </div>
      ) : error ? (
        <LoadError hint="分类列表没能取回来，可能是网络或服务暂时不可用。" onRetry={retry} />
      ) : categories.length === 0 ? (
        <EmptyState
          title="还没有分类"
          hint="分类正在整理中，先回发现页逛逛吧。"
          action={
            <button type="button" className="pill pill-ink" onClick={() => navigate('/')}>
              去发现页
            </button>
          }
        />
      ) : (
        <div className={GRID_CLASS}>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className="row row-pressable"
              style={{ alignItems: 'center' }}
              onClick={() =>
                navigate(`/category/${category.id}`, {
                  state: { name: category.name, emoji: category.emoji },
                })
              }
            >
              <CategoryGlyph category={category} />
              <span className="min-w-0 flex-1 type-manage text-[var(--ink)]">{category.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
