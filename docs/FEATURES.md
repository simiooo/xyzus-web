# 功能详解与实现记录

> 面向开发者 / 维护者。普通用户的使用说明见 [README](../README.md)；接口契约见 [API.md](API.md)；实测证据见 [VERIFICATION.md](VERIFICATION.md)；故障排查见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。
> 本文汇总登录内部机制、各功能模块的实现与已知限制（原 README §5、§6、§11–§21）。

## 1. 登录（扫码登录，2026-11 实测可用）

**上游已经关掉旧的短信登录**：`podcaster-api.xiaoyuzhoufm.com` 的 `/v1/auth/send-code` 与
`/v1/auth/login-with-sms` 现在都返回 **404**，所以 xyz 的 `/sendCode`、`/login` 已经不可用
（不是客户端 bug）。上游把网页登录迁到了 SSO：`accounts.xiaoyuzhoufm.com`，主路径是**扫码**。

客户端当前提供三种方式（`src/pages/Login.tsx`）：

### 1.1 扫码登录（默认，推荐）

与官方登录页同一套接口，token 在响应头里：

| 步骤 | 客户端请求 | 上游 | 契约 |
|---|---|---|---|
| 建码 | `POST /qrcode-api/create` | `POST https://web-api.xiaoyuzhoufm.com/v1/auth/qrcode/create` | body `{"clientId":"xyz-web"}`；需要请求头 `x-midway-app-id: v6worU4NnWyL`；返回 `{"id","url"}`，二维码内容就是这个 `url` |
| 轮询 | `POST /qrcode-api/login` | `POST .../v1/auth/qrcode/login` | body `{"id":"..."}`；状态 `WAITTING` → `SCANNED` → `USED`/`CONFIRMED`；成功时两个 token 在响应头 `x-jike-access-token` / `x-jike-refresh-token`；过期/无效 = HTTP 401 或 400 + `code:21` |

**必须走同源代理**：上游 CORS 只回显官方域与 `http://localhost:*`，自建域名直连会被拦。
所以 dev 由 `vite.config.ts` 的 `/qrcode-api` 规则转发、生产由 `nginx.conf` 的同名 location 转发
（两边都补 `x-midway-app-id` 头并透传 token 响应头）。浏览器端只认 `/qrcode-api/*`。

实现：`src/api/qrLogin.ts`（建码 / 轮询 / 状态机）+ `src/pages/Login.tsx`（二维码、状态文案、过期刷新、确认后自动进入）。

### 1.2 手机号 + 验证码（保留，但上游已失效）

上游短信通道现在直接 404，页面保留它只为将来上游恢复时可用；界面上会明确提示改用扫码。
`src/stores/authStore.ts` 会把 404 / 401 / 风控 `code:1003` 都翻译成中文可读错误。

### 1.3 粘贴 Token 兜底

`loginWithTokens(access, refresh)`：写入两个 token → 调 `/profile` 拉用户 → 置 `isAuthenticated`；
失败清空 token 并抛中文错误。登录页底部有「扫码/短信都不行？用 Token 登录」入口。

- token 存在 `localStorage`：`x-jike-access-token` / `x-jike-refresh-token`；用户缓存 `x-jike-user-profile`
- 两个 token 必须来自**同一次登录**，否则 401 刷新会失败（错误文案已写明）
- 扫码登录成功后拿到的就是这两个 token，所以它与 App / 网页登录等价

## 2. 付费 / 私密单集

上游对未购买/私密单集的 `media.source.url` 可能为 `null`。v1.10.0 起 xyz 提供
`POST /private_media_get`（body `{eid}`，上游 `GET /v1/private-media/get?dubbing=false&eid=`），
返回 `{url, key, ttl}`，**需要登录且已在小宇宙 App 内购买该单集**。

客户端兜底在 `src/api/episode.ts`：

```ts
import { resolveEpisodeAudioUrl } from '@/api/episode'

const source = await resolveEpisodeAudioUrl(episode)
if (!source.url) {
  // reason: 'PRIVATE_MEDIA_UNAVAILABLE' | 'NO_MEDIA' | 'FETCH_FAILED'
  useAudioStore.getState().pause()
  message.error('该单集为付费/私密内容，需先在小宇宙 App 内购买；当前账号未能获取播放地址')
} else {
  audioEl.src = source.url
}
```

取值顺序：`media.source.url` → `media.backupSource.url` → `enclosure.url` → `/private_media_get`。
`resolveEpisodeAudioUrl` 永不 reject，取不到时返回 `{url:null, reason}`，UI 用 `audioStore.pause()` + 中文 toast 兜底。

## 3. 消息 / 收件箱（2026-11 新增，已按真实抓包校准）

- **页面**：`/inbox`（`src/pages/Inbox.tsx`），「通知 / 收件箱」双 tab，默认通知；左栏「消息」、
  移动端顶栏铃铛进入，路由在 `src/router.tsx`；`?messageTab=inbox` 可直接预览收件箱。
- **数据**：
  - `src/api/notice.ts`：`noticeListAPI({loadMoreKey?})` → `{items: Notice[], loadMoreKey?}`（`/notice_list`）。
    真实结构：`action` = `LIKE` / `COMMENT`（+ `FOLLOW` 兜底）；`LIKE` 的触发者在 `source.users[0]`，
    `COMMENT` 在 `source.author`；被互动单集 eid 在 `target.owner.id`；渲染层仍保留容错提取。
  - `src/api/inbox.ts`：`inboxListAPI`（`/inbox_list_v2`，`limit:25` + `{pubDate,id}` 游标）、
    `inboxRemoveAPI(eids)`（`/inbox_remove`，收件箱「全部标为已读」调用）、`unreadCountAPI`（`/unread_count`）。
- **全部标为已读**：收件箱 tab 右上角胶囊按钮 → 批量把当前已加载 eid 传给 `/inbox_remove`，成功后清空列表并刷新未读。
- **未读徽标**：`src/components/shell/UnreadBadge.tsx` + `src/stores/notificationStore.ts`；
  `Layout` 里的 `useUnreadCount` 在登录后取一次，之后窗口聚焦 / 切回标签页 / 每 2 分钟刷新。
  打开消息页即把当前未读数记为本机已看，徽标隐藏；服务端数字之后的增长会重新亮起。
- **后端补丁**：`backend-patches/notification-endpoints.patch`（22 条代理路由，20117 B）覆盖通知 + 首页 tab +
  相关单集 + 收件箱 v2 + 评论增强 + AI 摘要/文字稿 + 关注动态/常听节目 + 播放状态同步 + 最近收听增量同步；`backend.Dockerfile` 在 pin 住的上游 commit 上自动 apply，
  干净 worktree 正向 `git apply` + `go build` 验证通过；端点用假 token 探测返回 401（见 [VERIFICATION.md](VERIFICATION.md)）。
- **Mock**：`notice_list` 14 条 / 6 条/页（真实形状转换 + 旧结构容错样本）、`inbox_list_v2` 6 条/页、
  `inbox_remove` 返回 null、`unread_count` 固定 3；`VITE_API_MOCK=1 pnpm dev` 可完整验收双 tab、分页、已读按钮与徽标。
- **限制**（同 PRD §19.3）：通知「拉列表即清未读」的实时语义仍用本机水位兜底；系统通知 UI 暂未接。

## 4. 发现页 X 式内容流与相关单集（2026-11 新增，后按 X 式重构）

- **入口层级 ↔ 布局映射**（2026-11 重构，X 式）：
  - 高频**内容流**放一级吸顶 tab：为你推荐（算法流，默认）→ 关注（听友动态）→ 分类（主题浏览）→ 精选（编辑内容，更新最慢）；
  - **工具型入口**（榜单）不占内容流 tab，留在左栏主导航/移动端底栏；搜索、账号、消息留在顶栏；
  - 页头大标题、副标题、「去榜单」按钮全部去掉，tab 栏贴内容区顶边、滚动时吸顶（移动端在 64px 顶栏下方吸顶）。
- **每个 tab 的数据**（`src/pages/Home.tsx` + `src/api/homeFeed.ts` + FollowingFeed）：
  - 为你推荐：`/tab_discovery_list` → 活动位、单集推荐（DISCOVERY_EPISODE_RECOMMEND_V3）、视频播客、三个榜单（TOP_LIST）；
  - 关注：`/following_updates_list`（复用 `/following` 的 `FollowingFeed` 组件，嵌入模式不显示页头和空态跳转）；
  - 分类：`/tab_category_list` → 分类块（EPISODE_CATEGORY_BLOCKS），每块最多 4 条单集，可进分类详情；
  - 精选：`/tab_featured_list` → 活动位（DISCOVERY_HEADER）、编辑精选（EDITOR_PICK），翻页追加节目推荐（DISCOVERY_COLLECTION）。
  - 首屏只加载当前 tab，切换保留已加载数据；每个 feed tab 独立分页（板块数组原样交给容错渲染器）；
    URL 同步：默认无参数=为你推荐，`?tab=following|category|featured` 可直达/分享。
- **活动位 / 快捷入口排版**：官方定位里优先级低，**Web 全尺寸统一收成单行小胶囊**（44px 高、横滑、
  隐藏滚动条、宽度随内容），不再用大 hero 或两列网格占首屏；右侧栏已删除与胶囊重复的「热门入口」，
  只保留榜单 / 分类 / 精选。胶囊按上游分层素材合成，透明素材用 `SmartImage tone="none"`；
  链接处理：站内路径 → 路由跳转，https → 新窗口，`cosmos://page.cos/webView?url=<https>` 解出内层 H5 新窗口，
  其余 `cosmos://` App 页点击时 toast「该入口仅支持在小宇宙 App 内打开」。
- **相关单集**：单集页在「节目笔记」之后、评论之前渲染 `/related_episode_list`（body `{eid}` → `EpisodeBasic[]`），
  最多 6 条，加载用行骨架，失败给中文提示 + 重试。
- **Mock**：`tab_featured_list` / `tab_discovery_list` / `tab_category_list` 各两页（第二页由 `loadMoreKey` 触发），
  `following_updates_list` 与 `related_episode_list` 也覆盖；`VITE_API_MOCK=1 pnpm dev` 可验收四个 tab 与相关单集。
- **截图**：`shots/home-v3/`（四个 tab + 吸顶 + 移动端）与 `shots/layout-check/`（活动位修复）。

## 5. 评论增强（2026-11 新增）

- **回复 v2**：单集页的回复列表切到 `/comment_list_thread_v2`（上游 `/v1/comment/list-thread/v2`，真实抓包 body
  `{primaryCommentId, order:"SMART"}`，响应多 `totalCount`）；前端统一归一化，页面无感、旧结构不崩。
- **我的评论**：账号菜单新增「我的评论」→ `/my-comments`：
  - 数据 `/comment_list_mine`（body `{order:"TIME"|"LIKE", limit}`，真实响应每条带 `episode`）；
  - 「最新 / 最热」两排序，只读列表（封面 + 评论两行 + 单集/节目/时间/赞数），点整行进对应单集；
  - 骨架 / 空态 / 错误重试齐备，不提供点赞、回复、删除入口。
- **时点评论**：`/comment_list_timestamp_primary`（body `{owner, from, to}`）返回的是**时点标记**
  `{id,timestamp,type}`，再用 `/comment_get?commentId=` 逐条取正文（xyz 新增 `/comment_get`）
  - 评论「时点」tab 按当前播放位置取 120s 窗口（`from = floor(t/120)*120`），显示
    「显示 00:00–02:00 附近的时点评论」+「刷新附近」；
  - 每行：`mm:ss` 时间戳（点击 seek/播放）+ 头像昵称 + 评论正文 + 赞数；空窗给「这个时间点附近还没有评论」；
  - 播放器 seek 时自动刷新窗口；`?commentOrder=TIMESTAMP` 可直接打开时点 tab（截图/分享用）。
- **Mock**：`comment_list_thread_v2`、`comment_list_mine`、`comment_list_timestamp_primary`、`comment_get`
  四个 handler + 我的评论 fixture；`VITE_API_MOCK=1 pnpm dev` 可验收「我的评论」页、回复加载与时点面板。
- **截图**：`shots/comment-check/`（我的评论）与 `shots/timepoint-check/`（时点评论，mock / 真实数据两版）。

## 6. AI 摘要与文字稿（2026-11 新增）

- **AI 摘要**：单集页在简介上方渲染「AI 摘要」+「内容由 AI 生成，仅供参考」。
  `POST /ai_summary_episode_retrieve_brief {eid}`（上游 `/v1/ai-summary/episode/retrieve-brief`）返回
  `{requested, summary:{status,brief,...}|null, confirmation}`；只有 `status === "ready"` 且有 brief 才显示，
  无摘要 / 429 限流 / 网络失败全部**静默隐藏**，不给页面加错误。
- **AI 文字稿**：先 `POST /episode_transcript_get {eid, mediaId}` 拿 `transcriptUrl`（CDN 签名地址），
  展开时再 `POST /episode_transcript_content {url}` 由后端代取 CDN JSON（只允许 `transcript.xyzcdn.net`
  / `transcript-highlight.xyzcdn.net`，8MB 上限）。正文是 `[{text, startMs}]`，UI 按 `mm:ss + 段落`
  渲染在 440px 滚动区里（点一行：正在播本集则 seek，否则从头播放）。
- **真实数据验证（2026-11-11）**：同一账号 token 下三条端点全部 200：摘要 brief 93 字；
  transcript 元数据正常；正文 787 段。截图 `shots/ai-check/`（mock 与真实数据各一版）。
- **Mock**：`ai_summary_episode_retrieve_brief`（mock-eid 有 ready 摘要）、`episode_transcript_get`、
  `episode_transcript_content`（6 段时间轴）；`VITE_API_MOCK=1 pnpm dev` 可验收两处展示与展开/收起。
- **限制**：摘要与文字稿依赖上游 AI 能力，不是每集都有；摘要上游按频率限流（429），页面按「有就展示」处理。

## 7. 关注动态与常听节目（2026-11 新增）

- **关注动态**：新页面 `/following`（账号菜单「关注动态」、我的订阅页头「关注动态 →」入口）。
  - 数据 `/following_updates_list`（body `{}`）→ 上游 `/v1/personal-update/list-following-updates`。
    真实抓包确认是 **POST** 而不是 GET（`GET` 会 404），响应 `{data:[{actionType:"PICK", item:{user, episode, story, pickedAt}}], showSticker}`。
  - 每行：听友头像 + 昵称 +「推荐了这期」+ 相对时间；有推荐语时显示引号一行；下面接 `EpisodeRow` 单集行。
  - 骨架 / 空态 / 错误重试齐备；只读，不引入关注/点赞写操作。
- **常听节目**：「我的订阅」页顶部横滑货架（`/subscription_often_played`，body `{limit:5}` →
  上游 `/v1/subscription/list-often-played`），最多 5 个节目，点击进节目页；失败静默隐藏。别人（`/subscriptions/:uid`）的订阅页不请求。
- **Mock**：`following_updates_list`（3 条动态）、`subscription_often_played`（6 个节目，前端截 5）两个 handler + fixture；
  `VITE_API_MOCK=1 pnpm dev` 可验收关注动态页与订阅页货架。
- **截图**：`shots/following-check/`（关注动态、我的订阅，mock + 真实数据）。
- **真实数据验证**：真实 token 下 `following_updates_list` 200（1 条动态）、`subscription_often_played` 200（3 个节目）。
- **顺延**：播放列表因只抓到 `playlist/patch`、缺 `playlist/pull` 读取契约，暂缓并记入待补抓清单。

## 8. 星标订阅（2026-11 新增）

- **入口**：我的订阅页（仅自己的）在订阅列表上方加「全部 / 星标」文字页签；`?filter=starred` 可直接预览星标 tab。
- **星标按钮**：自己订阅页每行行尾一个星形按钮（已星标 = 实心强调色，未星标 = 空心灰），旁边保留原订阅按钮；
  只读的「TA 的订阅」页不显示。
- **数据**：
  - 星标列表 `/subscription_star` → 上游 `/v1/subscription-star/list`（xyz 内置路由，真实返回 `{data:[...]}` 一次性、无分页）；
  - 星标切换 `/subscription_star_update`（body `{pid, withStar}`）→ 上游 `/v1/subscription-star/update`。
  - 全部列表里的 `subscriptionStar` 字段直接驱动按钮状态；切换时两份列表乐观更新，失败回滚并给中文提示。
- **空态**：「还没有星标节目」+「查看全部订阅」把筛选切回全部。
- **真实数据验证**：星标列表 200（1 个），星标/取消星标各 200，星标数 1→2→1（测试账号已还原，未留改动）。
- **Mock**：`subscription_star` / `subscription_star_update` 两个 handler（模块内维护可变 `Set`，星标 tab 与切换联动）；
  `VITE_API_MOCK=1 pnpm dev` 可验收筛选、切换与空态。
- **截图**：`shots/star-check/`（全部 / 星标，mock + 真实数据）。

## 9. 播放现场同步 / 续听（2026-11 新增）

- **目标**：对齐手机端「分布式续听」——刷新/重开页面或换设备后，自动回到上次收听的那一集与原进度。
- **数据（真实抓包 2026-11-11）**：
  - `POST /playback_progress_list {eids}` → `{data:[{eid,pid,progress,playedAt}]}`（服务端保存的播放进度）；
  - `POST /playback_progress_update {data:[{eid,pid,playedAt,progress}]}` → `{}`（写入进度）；
  - `POST /episode_played_create {eid}` → `{}`（记录开始收听 / 最近播放）；
  - `POST /episode_played_history_list {}` → `{data:[{episode,recentAudiences}], loadMoreKey}`（最近收听倒序，xyz 内置）。
- **前端实现**（`src/hooks/usePlaybackSync.ts` + `audioStore.restorePlayback` + `utils/playbackStorage.ts`）：
  1. **本地快照**：任何进度变化节流写 `localStorage: xyz:playback-state`（集快照 + 进度 + `playedAt`）；
     刷新/重开先恢复为「暂停态、停在原进度」，不依赖网络；
  2. **跨端恢复**：登录态就绪后拉最近收听 + 服务端进度，按 `playedAt` 取最新一条；远端明显更新时恢复并 toast 提示；
  3. **上报**：播放中每 10s、暂停 / seek / 页面隐藏 / 关闭时 POST 进度（带 `playedAt`）；新集开始时记录一次收听；
  4. **冲突协调**：`playedAt` 最后写入优先。本端正在播放时不被远端覆盖；页面重新可见且本端暂停时，
     若远端更新则自动 seek 到远端进度并提示。跨端（手机 → Web）与同浏览器刷新两种情况都实测通过。
- **两个坑**：
  - 上游用请求头 **`local-time`** 校验进度写入；固定旧值或格式不符会导致 `200` 但静默丢弃。xyz 已在 `utils/http.go`
    对每个上游请求无条件动态生成（对齐 App 格式：毫秒 + 无冒号时区），已纳入生产补丁（见本文「最近收听增量同步 + 补丁修复」）。
  - 浏览器禁止无手势自动播放：恢复后是**暂停态**（播放条显示原进度），用户点一下播放即从原进度继续。
- **Mock**：`episode_played_history_list`（最近一集 mock-eid）、`playback_progress_list`（120s）、
  `playback_progress_update` / `episode_played_create` 四个 handler；首次打开 mock 页面即可看到续听恢复。
- **截图**：`shots/playback-check/`（mock 恢复 02:00、真实数据恢复 36:09，播放条停在原进度）。

## 10. 本地缓存与写队列（2026-11，Phase 1 + Phase 2 + 增量同步）

- **存储**：Dexie 4（`dexie` 依赖）+ IndexedDB，库名 `xyz-web-db`（当前 schema v2）；按账号 uid 前缀隔离，
  不缓存 token / 音频 / 图片二进制；`clearAccountCache(uid)` 可整号清理（已接 `authStore.logout` 与登录失效两条路径）。
- **Phase 1：实体 / 页面缓存 + SWR**（`src/db/schema.ts`、`src/db/cache.ts`）：
  - `entities`：单集详情（`episode`）、节目详情+相关节目（`podcastBundle`）；
  - `pages`：首页三个 feed tab（`homeFeed`）、订阅列表首页（`subscriptionList`）；
  - 读：先读缓存立即渲染，`isFresh` 决定是否后台刷新；无缓存才骨架；刷新失败时保留旧内容；
  - TTL：单集 24h、节目 12h、首页精选 5min / 发现 3min / 分类 10min、订阅列表 5min；
  - 失效：星标/订阅写入成功后 `invalidateScope('subscriptionList')` + 定向清 `podcastDetail`；
  - 清理：启动时删除 30 天未刷新（按 `fetchedAt` 写入时间）的实体/页面。
- **Phase 2：outbox 写队列 + 节流**（`src/db/outbox.ts`、`src/hooks/useLocalSync.ts`）：
  - 写入（播放进度 / 星标 / 订阅）先落 IndexedDB，再按「账号 + kind + 实体」合并成最新一条；
  - 调度：入队 700ms 后 flush，每 15s 兜底重试，页面重新可见 / 离开时再 flush；
  - 批量：同轮播放进度按 eid 去重合并成一次 `playback_progress_update {data:[...]}`；
  - 失败：1s/2s/4s… 指数退避（上限 5min，最多 8 次后拉长），队列持久化、下次启动继续；
  - 页面关闭不丢写入，由 IndexedDB 持久化兜底。
- **增量同步：最近收听本地库**（`src/db/sync.ts`、`src/db/schema.ts` 的 `playedCache` 表，详见本文「最近收听增量同步 + 补丁修复」）：
  - 对齐 App 的 `list-for-cache` 版本游标机制：本地存一份最近收听快照 + `syncMeta` 游标 `playedCacheVersion`；
  - 同步带游标拉取，`needRefresh=true`（或首次无游标）才整体替换本地库并事务推进游标，`false` 保留缓存不重拉；
  - `useLocalSync` 按账号启停：启动 + 每 5min + 页面可见 + 网络恢复时各同步一次；只做同步层，暂无可见 UI（`readPlayedCache()` 留作消费入口）。
- **实测**（mock）：首次访问后 IDB 有 `entities=1 / pages=2`；把 API 延迟调到 3s 后二次打开，
  1.6s 内直接用缓存渲染完成（无骨架、无等待网络）；点一次星标后 outbox 落库 1 条并在 3s 内 flush 清空，
  同时该账号的 `subscriptionList` 缓存被失效。
- **边界**：首期只覆盖高价值域（单集/节目详情、首页 feed、订阅列表）；消息/评论等后续按域扩展；
  缓存是加速层，不是真相源，写操作成功仍以服务端为准。

## 11. 最近收听增量同步 + 补丁修复（2026-11-12）

- **目标**：把本文「本地缓存与写队列」的本地库从「TTL 过期重拉」补全为 App 同款的**版本游标增量同步**——本地维护一份「最近收听」快照，
  版本没变就不重拉，变了才整体替换。此前 `syncMeta` 表建了却没用，本次真正接上。
- **契约（真实抓包 2026-11-11 + APK 反编译双重确认）**：
  - 上游 `POST /v1/episode-played/list-for-cache`，xyz 代理 `/episode_played_list_for_cache`（补丁第 22 条路由）；
  - 请求 `{version?: ISO时间戳, loadMoreKey?}`：首次不带 version，之后带本地存的上次快照版本；
  - 响应 `{data: PlayedHistory[], version, needRefresh, loadMoreKey?}`：`data` 是当前最近收听快照（条目用 `id` 而非 `eid`，含 title/description/podcast），
    `version` 是快照版本，`needRefresh` 告知本地缓存是否过期。
  - App 侧语义（反编译 `EpiHistoryModelImpl`：`replaceHistoryCache` + `deleteOtherHistoryCacheVersions` + `history_cache_version`）是
    **带版本的全量快照替换**：`needRefresh=true` 整体替换并删旧版本行、推进游标；`false` 保留缓存。播放进度另走 `playback_progress_list`，不在此快照里。
- **前端实现**：
  - `src/api/playback.ts`：`episodePlayedCacheAPI(version?, loadMoreKey?)` → `{items, version, needRefresh, loadMoreKey}`；
  - `src/db/schema.ts`：新增 `playedCache` 表（DB **v2** 迁移，账号隔离 + `position` + `version`），`syncMeta` 游标 `playedCacheVersion` 与读写 helper；
  - `src/db/sync.ts`：`needRefresh=true`（或首次无游标）才事务化整体替换本地库并推进游标，`false` 直接返回；刷新时跟随 `loadMoreKey` 累积完整快照（上限 20 页防死循环）；
  - `src/hooks/useLocalSync.ts`：按 `userId` 启停（启动 + 每 5min + 页面可见 + 网络恢复）；`readPlayedCache()` 留作后续 UI / 播放恢复的消费入口（本期只做同步层，无可见 UI）。
- **一并修复的缺口**：
  - `clearAccountCache(uid)` 此前定义了却从未调用 → 经动态 import 接到 `authStore.logout` 与 refresh 失败的 `clearFn` 两条路径（断开 authStore↔schema 循环依赖），登出/换号不再残留本地库；
  - `outbox.enqueueOutbox` 的 delete+add 事务化；`reschedule` 去掉超限时的重复 update；`pruneStaleCache` 注释按实际「写入时间」语义修正。
- **后端补丁修复（重要）**：原 `notification-endpoints.patch` **漏了 `handlers/playback.go`**——router 引用了 `PlaybackProgressList` 等 handler 但补丁未创建该文件，
  在干净上游 `git apply` 后 `go build` 会因未定义 handler 失败。本次重新生成补丁纳入 `playback.go`（含新增 `EpisodePlayedListForCache`），
  补丁现为 **22 条代理路由 / 20117 B**（原 21 条 / 16393 B），含 `handlers/playback.go`。
- **local-time 生产修复**：抓包确认 App 的 `local-time` 格式是 `2026-11-11T21:57:37.943+0800`（毫秒 + 无冒号时区），
  而 `notificationHeaders` 默认的 `...Z07:00`（无毫秒、时区带冒号）会让上游对进度写入「200 但静默丢弃」。
  `utils/http.go` 现对**每个上游请求无条件**覆盖 `Local-Time` 为当前时间（App 格式），不再依赖 `XYZ_EXTRA_HEADERS`，已纳入补丁；
  compose 后端设 `TZ=Asia/Shanghai` 使偏移为 `+0800`。
- **验证**：
  - `pnpm lint`、`tsc -b && vite build` 全绿；本机后端与干净 worktree（pin `22cfe78`）apply 补丁后 `go build` 均通过；`docker compose config` 校验通过；
  - mock 模式真实浏览器实测：Dexie v2 迁移建表 ✓、首同步建库 + 游标 ✓、同版本二次同步 no-op（`syncedAt` 不变、不重拉）✓、
    播放新单集推进版本 → 整体替换 + 游标推进 + 快照顺序更新 ✓、登出后该账号所有表清零 ✓。
  - **未做**：真实上游联调（无新鲜 token），契约已由抓包 + APK 确认、后端路由编译通过；可见 UI（按本期范围只做同步层）。

## 12. P2 收尾记录（2026-11-11）

### 12.1 已完成批次

| 批次 | 功能 | 端点 |
|---|---|---|
| 通知 / 发现页 | 收件箱 v2 + 全部已读、X 式发现页内容流（为你推荐 / 关注 / 分类 / 精选）、相关单集 | 9 条代理路由 |
| 评论增强 | 回复 v2、我的评论页 `/my-comments`、时点评论面板（标记 + `/comment_get` 正文） | 4 条代理路由 |
| AI 能力 | 单集 AI 摘要、AI 文字稿（后端受限 CDN 代理） | 3 条代理路由 |
| 关注 / 订阅 | 关注动态 `/following`、常听节目货架 | 2 条代理路由 |
| 星标订阅 | 订阅页「全部 / 星标」筛选 + 行尾星标切换 | xyz 内置 2 条路由，无需补丁 |
| 播放现场同步 | 本地快照 + 服务端跨端恢复 + 进度上报 / `playedAt` 最后写入优先的冲突协调 | 3 条代理路由（+ xyz 内置 1 条） |

合计：xyz 补丁 **21 条代理路由 / 16393 B**（本次增量同步后为 22 条 / 20117 B，见上文）；客户端新增使用 **56 个端点**（[API.md](API.md)）。

### 12.2 收尾验证

- `pnpm lint`、`tsc -b --force`、`pnpm build` 全绿。
- Mock 全页面截图 18 条路由（`shots/regression/`）：全部渲染成功、无横向溢出、无运行时异常——
  覆盖发现页四个内容流 tab（含吸顶与活动位排版）、消息双 tab、我的评论、关注动态、订阅/星标、单集（AI 摘要 / 文字稿展开 / 时点评论）、
  节目页、榜单、分类、编辑精选、收藏、搜索。
- 真实账号 token 抽查 **21 条端点全部 200**（读接口 + 播放进度写接口；`inbox_remove` 写操作与
  系统通知两条未接 UI 的路由未做真实调用）；跨端续听实测：服务端恢复 2169s → Web seek 2229s → 服务端读到 2229，
  旧 `playedAt` 回写被服务端拒绝（LWW 生效），测试账号进度已还原。
- 补丁在干净 worktree（pin `22cfe78`）正向 `git apply` + `go build` 通过（产物约 16.0 MB）。
- 真实数据/回归截图：`shots/real-check/`、`shots/comment-check/`、`shots/ai-check/`、`shots/following-check/`、
  `shots/star-check/`、`shots/timepoint-check/`、`shots/regression/`、`shots/playback-check/`；
  首页活动位排版修复见 `shots/layout-check/`。

### 12.3 待办 / 明确不做

- **播放列表**：抓包只有 `custom-playlist/config/get`（运营活动配置）与 `playlist/patch`（加单集 CAS），
  缺 `playlist/pull` 读取契约，需补抓后再做。
- **故事收件箱 / 周报**：抓包列表为空或字段缺失（`story-inbox/list` 空数组、`weekly-letter/get-latest` 无数据），
  需补抓后做。
- **系统通知 UI**：xyz 代理路由已备，但上游字段未校准，暂缓。
- **运营广告位**（`flash-screen/list`、`flash-mob/list`，淘宝/香奈儿等全屏广告）：主动不做。

## 13. 已知限制

- 上游短信登录已关闭（`podcaster-api` 的 auth 路径 404），登录主路径是**扫码**（见本文「登录」）；
  扫码依赖上游 `web-api` 的稳定性与 CORS/代理配置，若上游调整接口需要同步更新 `src/api/qrLogin.ts`。
- 收藏列表、部分上游列表不分页（如 `/favorite_episode_list` 全量返回），页面需自行分批渐显。
- 消息中心：未读数只有数字、上游没有已读接口 —— 徽标按**本机已读水位**隐藏（写
  `localStorage: xyz:notification-seen-count`），换设备 / 清缓存后会重新显示；通知字段已按真实抓包
  校准（action = `LIKE` / `COMMENT`，`source.users` / `source.author`），系统通知与「互动通知拉取即清未读」
  的实时语义仍按本机水位兜底。收件箱走 v2 + `inbox_remove` 已读。
- 发现页各 tab 的板块结构来自上游多态 JSON，页面用容错渲染：认不出的板块类型会跳过，
  上游改结构时只会少内容，不会整页崩；`/tab_featured_list` 的 DISCOVERY_COLLECTION 等变体按同思路处理。
- **播放列表暂缓**：全站抓包里只有 `custom-playlist/config/get`（运营活动配置）和 `playlist/patch`
  （加单集，CAS `base`+`ops`），缺 `playlist/pull` 读取契约，暂时无法还原「我的播单」；需要补抓该接口后再做。
- no test suite / no CI（见 [AGENTS.md](../AGENTS.md)）；接口回归靠 [VERIFICATION.md](VERIFICATION.md) 的 curl 清单。