import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { Spin } from 'antd'
import Layout from '@/components/Layout'
import AuthGuard from '@/components/AuthGuard'
import Login from '@/pages/Login'

const Home = lazy(() => import('@/pages/Home'))
const PodcastDetail = lazy(() => import('@/pages/PodcastDetail'))
const EpisodeDetail = lazy(() => import('@/pages/EpisodeDetail'))
const Search = lazy(() => import('@/pages/Search'))
const Toplist = lazy(() => import('@/pages/Toplist'))
const EditorPicks = lazy(() => import('@/pages/EditorPicks'))
const Categories = lazy(() => import('@/pages/Categories'))
const CategoryDetail = lazy(() => import('@/pages/CategoryDetail'))
const Favorites = lazy(() => import('@/pages/Favorites'))
const Subscriptions = lazy(() => import('@/pages/Subscriptions'))

function LazyLoad({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    }>
      {children}
    </Suspense>
  )
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
      { path: 'favorites', element: <LazyLoad><Favorites /></LazyLoad> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

export default router
