# xyz-web — 宇宙电台（小宇宙播客 Web 客户端）

## Stack

React 19 + TypeScript 6 + Vite 8 + Ant Design 6 + Alova 3 + Zustand 5 + React Router 7 + Tailwind CSS 3 + Dexie 4

## Commands

```sh
pnpm dev        # Vite dev server（/discovery 等端点代理到 xyz 后端 http://localhost:23020）
pnpm build      # tsc -b && vite build（先类型检查）
pnpm lint       # ESLint flat config
pnpm preview    # vite preview
```

后端是自建的 [ultrazg/xyz](https://github.com/ultrazg/xyz)（Go 单一进程，默认监听 23020）。
本机联调时把它跑起来：`go build -o xyz.exe .` 后执行 `xyz.exe`。没有后端也能看界面：
`VITE_API_MOCK=1 pnpm dev` 会走离线 mock 数据（`src/mock/`）。
截图验收：`node scripts/shot.mjs --url http://127.0.0.1:5173/ --out shots/home.png`。

No test suite, no formatter config, no CI, no pre-commit hooks.

## Key conventions

- **Package manager**: pnpm（不要用 npm / yarn）。
- **Path alias**: `@/` → `src/`（内部 import 一律用它）。
- **Component exports**: 一律 default export；工具函数具名导出。
- **UI 规范**: **先读 [`docs/DESIGN.md`](docs/DESIGN.md)**，它是视觉与交互的唯一真源
  （白底墨字、点线分结构、强调色只用于交互强调：播放/主按钮/选中/激活/链接，正文始终墨色；字体是 CDN 的 MiSans（国内优先、海外兜底），失败回退系统字体）。
  - 颜色只用 `src/index.css` 里的语义变量或 `src/theme.ts` 的 token，**不要在页面里写新的十六进制色值**。
  - 主题色两版（蓝 / 粉）+ 外观两版（白&墨 / 夜间），由 `src/stores/themeStore.ts` 切换（写进
    `document.documentElement` 的 `data-accent` / `data-theme`），Ant Design 侧由
    `buildTheme(accent, appearance)` 出 token；URL 可直接预览 `?theme=dark`、`?accent=pink`。
  - 图片一律用 `src/components/ui/SmartImage.tsx`（渐进加载：空状态 → 缩略图 → 大图），不要裸 `<img>`。
  - 加载用 `src/components/ui/Skeleton.tsx` 的骨架，空用 `EmptyState`，不要居中 Spin / antd Empty。
- **图标**：统一用 `lucide-react`（描边 1.75，尺寸按场景 14–20px），实心状态加 `fill="currentColor"`；不要再引入别的图标包。
- **Styling**: Tailwind utility 类 + `src/index.css` 的语义工具类（`type-*`、`.pill`、`.dotted-rows`、
  `.shelf`、`.row`）。**`preflight: false`**：没有 CSS reset，Ant Design 自己管。
- **State**: Zustand，`src/stores/`（auth / audio / theme / ui / app / notification）。
- **API client**: Alova（`src/alova.ts`）。**所有端点都是 POST**（xyz 的约定）。请求头带
  `x-jike-access-token`；401 自动 refresh → 重试 → 失败广播 `auth:expired`。
- **API layer**: `src/api/` 一个域一个文件；后端返回层层包裹（`data.data.items` 之类），
  统一在 api 层归一化成干净数组/对象，页面只拿干净数据。

## Architecture notes

- **React Compiler**: 通过 `@rolldown/plugin-babel` + `babel-plugin-react-compiler`（`vite.config.ts`）。
- **Router**: `createBrowserRouter`（React Router 7 data router），`src/router.tsx`；
  懒加载页面用 `React.lazy` + `Suspense`，fallback 是骨架。
- **Auth**: 主路径是**扫码登录**（官方 accounts SSO：`/qrcode-api/create|login` 同源代理到 web-api，token 在响应头）；
  `AuthGuard` 包住除 `/login` 外的全部路由。短信登录上游已关闭（404），仅保留代码；另有「粘贴 token」兜底。
  token 刷新在启动时与 401 时触发。
- **Layout**: X 式三列 —— 左导航 248 + 中间内容 680 + 右侧栏 340（最大 1268，整体居中）；<1280 收右栏、<1024 收左栏。右栏是搜索 + 榜单 + 分类 + 精选（重复的「热门入口」已删除）；中间是单列 feed。播放条常驻，移动端顶栏 + 底栏。
  播放器只有一条播放条 + 一个展开面板（`PlayerSheet`），不再有独立右栏播放器。
- **发现页数据**: 发现页已按 X 式重构：顶部吸顶内容流 tab「为你推荐 / 关注 / 分类 / 精选」，无大标题；
  关注 tab 复用 `components/feeds/FollowingFeed.tsx`；发现页（Home）不做路由懒加载，避免三段骨架跳变。
- **Player**: `src/components/AudioPlayer.tsx` 是唯一持有 `<audio>` 的地方；
  UI 只读写 `src/stores/audioStore.ts` 的状态与意图。
- **消息 / 收件箱**: `/inbox` 页面（`src/pages/Inbox.tsx`）分「通知 / 收件箱」双 tab：通知走
  `/notice_list`（xyz 补丁端点，真实抓包已校准 `LIKE` / `COMMENT` 与 `source.users` / `source.author`），
  收件箱走 `/inbox_list_v2`（App 3.4.2 的 v2，limit 25 + `{pubDate,id}` 游标），「全部标为已读」调 `/inbox_remove`；
  `Layout` 里的 `useUnreadCount` 轮询 `/unread_count`。未读徽标用本机已读水位（`notificationStore`）。
- **发现页 / 单集推荐**: `/` 是 X 式吸顶 tab 内容流（为你推荐 / 关注 / 分类 / 精选），分别走
  `/tab_discovery_list`、`/following_updates_list`（FollowingFeed）、`/tab_category_list`、`/tab_featured_list`；
  板块是上游多态 JSON、由 `Home.tsx` 的容错渲染器消化；单集页的「相关单集」走 `/related_episode_list`。
- **评论增强**: 单集回复列表走 `/comment_list_thread_v2`；评论「时点」tab 走 `/comment_list_timestamp_primary`
  （120s 窗口返回 `{id,timestamp,type}` 标记）+ `/comment_get`（按 id 取评论正文），seek 时自动刷新窗口；
  「我的评论」页 `/my-comments`（账号菜单入口）走 `/comment_list_mine`（只读，最新 / 最热）。
- **AI 摘要 / 文字稿**: 单集页走 `/ai_summary_episode_retrieve_brief`（只有 ready 时显示，限流静默）；
  文字稿先 `/episode_transcript_get` 拿 CDN 签名地址，正文由 `/episode_transcript_content` 后端代理取
  （只允许 transcript.xyzcdn.net）。
- **关注动态 / 常听节目**: `/following` 页走 `/following_updates_list`（真实抓包是 POST body `{}`；
  GET 会 404，响应 `{data, showSticker}`）；「我的订阅」顶部「常听节目」走 `/subscription_often_played`（body `{limit}`）。
- **星标订阅**: 订阅页「全部 / 星标」筛选走 `/subscription_star`（xyz 内置路由），切换走
  `/subscription_star_update {pid, withStar}`；全部列表的 `subscriptionStar` 字段驱动按钮，乐观更新+失败回滚。
- **播放现场同步 / 续听**: `src/hooks/usePlaybackSync.ts`（Layout 挂载）负责 localStorage 快照、
  跨端恢复（`/episode_played_history_list` + `/playback_progress_list`）、进度上报（`/playback_progress_update`，
  播放中 10s / 暂停 / seek / 页面隐藏）和 `playedAt` 最后写入优先的冲突协调；
  `audioStore.restorePlayback` + `AudioPlayer` 在 metadata 就绪后 seek 到恢复进度（暂停态，不能自动播放）。
  本机设备头覆盖模式下 `utils/http.go` 每次请求动态生成 `local-time`，否则上游会 200 但静默丢弃进度写入。
- **本地缓存 / 写队列**: Dexie 4 + IndexedDB（`src/db/`，库 `xyz-web-db`，按 uid 隔离）：
  Phase 1 对单集/节目详情、首页 feed、订阅列表做实体/页面缓存 + stale-while-revalidate（TTL 见 `src/db/cache.ts`）；
  Phase 2 用 outbox（`src/db/outbox.ts`）承接播放进度/星标/订阅写入，同 key 合并最新、700ms 调度、15s 兜底、
  失败指数退避；`useLocalSync` 负责启动清理与自动 flush。缓存是加速层，写成功仍以服务端为准。
- **后端补丁**: 以上通知 / 首页 / 相关单集 / 收件箱 v2 / 评论增强 / AI / 关注动态 / 播放同步共 21 条代理路由都在
  `backend-patches/notification-endpoints.patch`（16393 B），`backend.Dockerfile` 在 pin 住的上游 commit 上自动 apply。
- **Env**: `VITE_API_BASE_URL`（`.env` / `.env.development` / `.env.production`），
  `VITE_API_MOCK=1` 启用离线 mock。
