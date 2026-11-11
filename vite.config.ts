import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from 'node:path'

/**
 * dev 代理：前端所有接口请求都走 `/api/*` 前缀，由下面这一条前缀规则转发到自建 xyz 后端
 * （生产环境 nginx 用完全相同的 `/api/` 规则，dev 与 prod 行为一致）。
 *
 * 为什么不逐个列端点：手写 `^/discovery$` 之类的清单容易漏（xyz 有 60+ 个 POST 端点，
 * 见 D:\work\xyz-backend\router\router.go），并且 `^/login$`、`^/profile$` 这类
 * 与前端页面路由同名的规则会把浏览器导航请求也代理到后端，导致页面 404。
 * 用单一 `/api` 前缀就没有这个冲突：`/login` 永远是前端页面，`/api/login` 才是后端接口。
 *
 * 后端地址可用环境变量覆盖：XYZ_API_TARGET=http://localhost:23020 pnpm dev
 */
const API_PREFIX = '/api'
const apiTarget = process.env.XYZ_API_TARGET || 'http://localhost:23020'

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
    // 同时监听 IPv4/IPv6：默认只绑 ::1 时 127.0.0.1 会连不上，
    // 文档与截图脚本里两种写法都可能出现。
    host: true,
    watch: {
      /**
       * Windows + chokidar 的已知问题：编辑器/写文件工具采用「先写 .<name>.<pid>.<uuid>.tmpdir/name.tmp
       * 再原子改名」的方式落盘，watcher 盯到临时目录后文件被改名/删除会抛
       * `EBUSY: resource busy or locked`，整个 dev server 直接退出。
       * 这里忽略临时文件、截图产物和依赖目录，避免全队写文件时反复杀掉 dev。
       */
      ignored: [
        '**/*.tmpdir/**',
        '**/*.tmp',
        '**/shots/**',
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
      ],
    },
    proxy: {
      [API_PREFIX]: {
        target: apiTarget,
        changeOrigin: true,
        // /api/discovery -> http://localhost:23020/discovery
        rewrite: (p) => p.replace(new RegExp(`^${API_PREFIX}`), ''),
        // 浏览器直接导航到 /api/*（Accept 带 text/html）时不代理，交回前端路由；
        // 接口请求（Accept 为 */* 或 application/json）正常转发。
        bypass(req) {
          const accept = req.headers.accept ?? ''
          if (String(accept).includes('text/html')) return req.url
          return undefined
        },
      },
      /**
       * 扫码登录代理（web-api 的 CORS 只回显官方域与 localhost，自建域名会被拦，
       * 所以统一走同源代理；生产 nginx 用同一条规则，见 nginx.conf）。
       *   /qrcode-api/create -> https://web-api.xiaoyuzhoufm.com/v1/auth/qrcode/create
       *   /qrcode-api/login  -> https://web-api.xiaoyuzhoufm.com/v1/auth/qrcode/login
       * x-midway-app-id 由代理补上，浏览器端不必也不该关心它。
       */
      '/qrcode-api': {
        target: 'https://web-api.xiaoyuzhoufm.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/qrcode-api/, '/v1/auth/qrcode'),
        headers: {
          'x-midway-app-id': 'v6worU4NnWyL',
          origin: 'https://accounts.xiaoyuzhoufm.com',
          referer: 'https://accounts.xiaoyuzhoufm.com/',
        },
      },
    },
  },
})
