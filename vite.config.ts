import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from 'node:path'

const apiTarget = 'http://localhost:23020'

const proxyPatterns = [
  'sendCode', 'login', 'refresh_token', 'profile',
  'discovery', 'top_list', 'pilot_discovery_list', 'editor_pick_list_history',
  'podcast_detail', 'episode_list', 'podcast_related', 'podcast_get_info',
  'episode_detail', 'episode_list_by_filter', 'favorite_episode_update', 'favorite_episode_list',
  'search', 'search_preset',
  'comment_primary', 'comment_thread', 'comment_create', 'comment_like_update',
  'comment_remove', 'comment_collect_create', 'comment_collect_remove', 'comment_collect_list',
  'category_list', 'category_list_tab', 'category_podcast_list',
  'pick_recent',
  'subscription', 'subscription_update', 'subscription_star', 'subscription_non_starred', 'subscription_star_update',
]

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: Object.fromEntries(
      proxyPatterns.map((p) => [
        `^/${p}$`,
        { target: apiTarget, changeOrigin: true },
      ])
    ),
  },
})
