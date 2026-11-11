/* eslint-disable react-refresh/only-export-components -- 路由表是配置而不是组件模块，热更新规则不适用 */
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import Layout from '@/components/Layout'
import AuthGuard from '@/components/AuthGuard'
import Login from '@/pages/Login'
// 发现页是首屏：不做懒加载，避免「路由骨架 → 页面骨架 → 内容」三段跳变
import Home from '@/pages/Home'
import { EpisodeRowsSkeleton, SkeletonBox } from '@/components/ui/Skeleton'

const PodcastDetail = lazy(() => import('@/pages/PodcastDetail'))
const EpisodeDetail = lazy(() => import('@/pages/EpisodeDetail'))
const Search = lazy(() => import('@/pages/Search'))
const Toplist = lazy(() => import('@/pages/Toplist'))
const EditorPicks = lazy(() => import('@/pages/EditorPicks'))
const Categories = lazy(() => import('@/pages/Categories'))
const CategoryDetail = lazy(() => import('@/pages/CategoryDetail'))
const Favorites = lazy(() => import('@/pages/Favorites'))
const Subscriptions = lazy(() => import('@/pages/Subscriptions'))
const Inbox = lazy(() => import('@/pages/Inbox'))
const MyComments = lazy(() => import('@/pages/MyComments'))
const Following = lazy(() => import('@/pages/Following'))

/** 路由懒加载的占位：用骨架，不用居中的转圈 */
function PageFallback() {
  return (
    <div aria-busy="true" aria-live="polite">
      <SkeletonBox className="h-[30px] w-[200px]" rounded="sm" />
      <div className="mt-8">
        <EpisodeRowsSkeleton count={5} />
      </div>
    </div>
  )
}

function LazyLoad({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <Layout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <LazyLoad><Home /></LazyLoad> },
      { path: 'toplist/:category', element: <LazyLoad><Toplist /></LazyLoad> },
      { path: 'podcast/:pid', element: <LazyLoad><PodcastDetail /></LazyLoad> },
      { path: 'episode/:eid', element: <LazyLoad><EpisodeDetail /></LazyLoad> },
      { path: 'search', element: <LazyLoad><Search /></LazyLoad> },
      { path: 'categories', element: <LazyLoad><Categories /></LazyLoad> },
      { path: 'category/:id', element: <LazyLoad><CategoryDetail /></LazyLoad> },
      { path: 'editor-picks', element: <LazyLoad><EditorPicks /></LazyLoad> },
      { path: 'subscriptions/:uid?', element: <LazyLoad><Subscriptions /></LazyLoad> },
      { path: 'inbox', element: <LazyLoad><Inbox /></LazyLoad> },
      { path: 'my-comments', element: <LazyLoad><MyComments /></LazyLoad> },
      { path: 'following', element: <LazyLoad><Following /></LazyLoad> },
      { path: 'favorites', element: <LazyLoad><Favorites /></LazyLoad> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

export default router
