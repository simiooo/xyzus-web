import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight } from 'lucide-react'
import SearchField from './SearchField'
import { categoryListAPI } from '@/api/category'

interface CategoryLink {
  id: string
  name: string
  emoji?: string
}

const CHARTS = [
  { key: 'HOT', title: '最热榜', description: '过去一周被收听最多的单集' },
  { key: 'ROCK', title: '锋芒榜', description: '锋芒初露的新锐单集' },
  { key: 'NEW', title: '新星榜', description: '刚刚上线的新单集' },
] as const

/**
 * 右侧栏（X 式）：顶部搜索，下面是榜单 / 分类 / 精选三组轻量链接。
 * 「热门入口」与发现页顶部的快捷胶囊重复，且官方定位里优先级低，已删除。
 */
export default function RightSidebar() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<CategoryLink[]>([])

  useEffect(() => {
    let cancelled = false

    categoryListAPI()
      .then((list) => {
        if (cancelled) return
        setCategories(list.slice(0, 8).map((item) => ({ id: item.id, name: item.name, emoji: item.emoji })))
      })
      .catch(() => {
        /* 侧栏是辅助信息，失败就少一组 */
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <aside className="hidden w-[var(--right-w)] shrink-0 xl:block">
      <div className="sticky top-0 flex h-screen flex-col overflow-y-auto scroll-thin px-6 py-5">
        <SearchField />

        <Group title="榜单">
          {CHARTS.map((chart) => (
            <button
              key={chart.key}
              type="button"
              onClick={() => navigate(`/toplist/${chart.key}`)}
              className="group w-full rounded-lg border-0 bg-transparent px-2 py-2 text-left transition-colors hover:bg-[var(--sunken)]"
            >
              <span className="block type-manage text-[var(--ink)]">{chart.title}</span>
              <span className="mt-0.5 block truncate type-meta">{chart.description}</span>
            </button>
          ))}
        </Group>

        <Group title="分类">
          {categories.length === 0 && (
            <div className="flex flex-wrap gap-1.5 px-2 py-1" aria-busy="true">
              {[68, 56, 80, 62, 74, 58].map((width, index) => (
                <span key={index} className="h-6 rounded-full bg-[var(--muted)]" style={{ width }} />
              ))}
            </div>
          )}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-2 py-1">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => navigate(`/category/${category.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 type-manage text-[var(--ink-soft)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)]"
                >
                  {category.emoji && <span aria-hidden>{category.emoji}</span>}
                  {category.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => navigate('/categories')}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 type-manage text-[var(--accent-ink)] hover:bg-[var(--accent-container)]"
              >
                全部分类
                <ArrowRight size={12} strokeWidth={2} />
              </button>
            </div>
          )}
        </Group>

        <Group title="精选">
          <button
            type="button"
            onClick={() => navigate('/editor-picks')}
            className="group flex w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-2 text-left transition-colors hover:bg-[var(--sunken)]"
          >
            <span className="min-w-0 flex-1">
              <span className="block type-manage text-[var(--ink)]">编辑精选</span>
              <span className="mt-0.5 block type-meta">编辑部每天挑出的单集与推荐语</span>
            </span>
            <ArrowRight size={14} strokeWidth={2} className="flex-shrink-0 text-[var(--faint)] opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        </Group>

        <p className="mt-auto pt-6 type-meta">宇宙电台 · 小宇宙播客网页版 · 字体 MiSans</p>
      </div>
    </aside>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="m-0 mb-1 px-2 type-section">{title}</h2>
      {children}
    </section>
  )
}
