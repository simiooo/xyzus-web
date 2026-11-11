# 离线 Mock 数据层（`src/mock/`）

没有 xyz 后端、也没有小宇宙 token 时，用这套 fixtures 让整个 Web 客户端跑起来并可用于截图验收。

```
src/mock/
├─ fixtures.ts   全量中文播客假数据（播客/单集/评论/分类/榜单/发现页/搜索…）
├─ handlers.ts   端点 → fixture 的解析（分页 / delay / 路径匹配），adapter 与 mock server 共用
├─ adapter.ts    createMockAdapter()：alova 兼容的 requestAdapter
└─ index.ts       统一出口（AuthGuard 直接用 `@/mock` 的 isMockEnabled）
```

## 三种启用方式

### 1. VITE_API_MOCK（推荐，Lead 在 `src/alova.ts` 接入）

```ts
// src/alova.ts
import { createMockAdapter } from '@/mock'

const alova = createAlova({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  requestAdapter: createMockAdapter(), // auto：VITE_API_MOCK / ?mock=1 / localStorage 任一开启
  // ...
})
```

```sh
VITE_API_MOCK=1 pnpm dev
```

> `createMockAdapter()` 默认 `enabled: 'auto'`，未启用时 pass-through 到真实 fetch，
> 不会改变原有联调行为。也可以显式 `createMockAdapter({ enabled: true })`。

### 2. 运行时开关（不用改环境变量，也不用重启 dev server）

按优先级：URL `?mock=1`（会写进 localStorage，SPA 内跳转保持）→ `window.__XYZ_MOCK__ = true`
→ `localStorage.setItem('xyz-mock','on')` → `VITE_API_MOCK=1`。
`?mock=0` / `localStorage.setItem('xyz-mock','off')` 显式关闭。

```
http://127.0.0.1:5173/?mock=1
```

### 3. 独立 Mock HTTP 服务（完全不改 `src/alova.ts` 也能用）

`scripts/mock-server.mjs` 和 `handlers.ts` 共用同一份 fixtures；dev 代理默认把 `/api/*`
转发到 `http://localhost:23020`，直接占这个端口即可：

```sh
node scripts/mock-server.mjs        # 监听 23020
pnpm dev                            # 另开终端
# 浏览器打开 http://127.0.0.1:5173/?mock=1
```

23020 被真实后端占用时：`node scripts/mock-server.mjs --port 5188` +
`XYZ_API_TARGET=http://127.0.0.1:5188 pnpm dev`。

> 截图脚本 `scripts/shot.mjs` 还有第四种：内置 CDP Fetch 拦截 `/api/*` 直接回 fixtures，
> 所以即使 alova 还没接入 mock，截图也能看到完整数据。

## fixture 形状约定

- fixtures 是 **「alova 响应拦截器剥掉 `{code,msg,data}` 之后」** 的 data，也就是 xyz 后端
  组装出的「上游原始 JSON body」。`src/api/*.ts` 会再 `unwrapData/unwrapPage/pluckList` 归一化一次。
- 因此 handler 刻意按真实后端形状返回，例如 `top_list` 是
  `{data:{items:[{item:<episode>}]}}`，`discovery` 是 `{data:[{type,data}],loadMoreKey}`，
  `profile` 是 `{data:<user>}`，`login` 是 token 在顶层 + `data` 里是 user。
- 图片全部是真实可访问的 `https://picsum.photos/seed/...`，每个 `ImageUrls` 都填满五档
  （thumbnailUrl / smallPicUrl / middlePicUrl / largePicUrl / picUrl），picUrl 用最大图，
  `SmartImage` 的「空 → 缩略图 → 大图」渐进加载因此有东西可验收。
- 延时：默认 600ms；`?delay=0` 或 body `__delay` 覆盖；mock server 用 `--delay`。

## 端点覆盖（58 个，按路径最后一段匹配）

| 领域 | 端点 | 关键参数 / 行为 |
| --- | --- | --- |
| 发现 | `discovery` | `loadMoreKey` 有值返回第二页 |
| 榜单 | `top_list` | `category: HOT/ROCK/NEW`，返回 `{data:{items:[{item}]}}` |
| 编辑 | `editor_pick_list_history` | 3 天/页，第二页由 `loadMoreKey` 触发 |
| 编辑 | `pilot_discovery_list` | 4 条/页 |
| 播客 | `podcast_detail` | `{pid}`；未知 pid 回落到 `mock-pid` |
| 播客 | `episode_list` | `{pid,order}`；每页 8 条 + `loadMoreKey:{direction,id,pubDate}` |
| 播客 | `podcast_related` | `{pid}` → 4 个相关播客 |
| 播客 | `podcast_get_info` | `{pid}` → `{ipLoc,organization}` |
| 单集 | `episode_detail` | `{eid}`；未知 eid 回落到 `mock-eid` |
| 单集 | `episode_list_by_filter` | 按 `filter` 过滤收藏/精选/已播 |
| 单集 | `favorite_episode_list` | 全量 `{data:[...]}`，不分页 |
| 单集 | `favorite_episode_update` | 返回 null |
| 单集 | `private_media_get` | `{eid}` → `{data:{url,key,ttl}}` |
| 搜索 | `search` | `{keyword,type}`；HEADER/FOOTER/SEARCHED_USERS 分组 + 第二页 |
| 搜索 | `search_preset` | 10 个中文热搜词 |
| 评论 | `comment_primary` | 新 api 传 `owner:{id,type}`，兼容旧 `id`；6 条/页 |
| 评论 | `comment_thread` | `{primaryCommentId}` → 主播/听众回复 |
| 评论 | `comment_create` | 返回新评论 `{data:<comment>}` |
| 评论 | `comment_like_update` / `comment_remove` / `comment_collect_create` / `comment_collect_remove` | 返回 null |
| 评论 | `comment_collect_list` | 5 条我收藏的评论 |
| 分类 | `category_list` / `category_list_tab` / `category_podcast_list` | 12 个中文分类 + 全部/热门/最新 tab |
| 订阅 | `subscription` | 5 条/页，`loadMoreKey:{skip}` |
| 订阅 | `subscription_update` | `{pid,mode}` → 更新后的 podcast |
| 消息 | `inbox_list` | `{loadMoreKey?:{pubDate,id}}` → 6 条/页（共 14 条订阅更新），游标按 id 定位 |
| 消息 | `inbox_list_v2` | `{limit?,loadMoreKey?}` → 与 v1 同数据 + `userStats`（收件箱实际用 v2） |
| 消息 | `unread_count` | 固定 `{data:{unreadCount:3}}`（上游只有数字、没有内容） |
| 消息 | `notice_list` | `{loadMoreKey?}` → 6 条/页（共 14 条互动通知；真实抓包形状 LIKE/COMMENT + 少量旧结构容错样本） |
| 消息 | `inbox_remove` | `{eids:[]}` → null（收件箱「全部标为已读」） |
| 首页 | `tab_featured_list` | 精选 tab 两页：活动位 + 编辑精选 → 节目推荐 |
| 首页 | `tab_discovery_list` | 发现 tab 两页：活动位 + 单集推荐 + 视频播客 + 三榜单 |
| 首页 | `tab_category_list` | 分类 tab 两页：EPISODE_CATEGORY_BLOCKS（12 个分类块） |
| 单集 | `related_episode_list` | `{eid}` → 10 条跨节目相关单集 |
| 评论 | `comment_list_thread_v2` | `{primaryCommentId,order}` → 回复列表 + `totalCount` |
| 评论 | `comment_list_mine` | `{order,limit}` → 我的 3 条评论（带 episode，按最新 / 最热排序） |
| 评论 | `comment_list_timestamp_primary` | `{owner,from,to}` → 该单集前 3 个时点标记 `{id,timestamp,type}` |
| 评论 | `comment_get` | `{commentId}` → 单条评论（时点标记取正文用） |
| 单集 | `ai_summary_episode_retrieve_brief` | `{eid}` → mock-eid 有 ready 摘要，其余为 null |
| 单集 | `episode_transcript_get` | `{eid,mediaId}` → 文字稿元数据（CDN 签名地址） |
| 单集 | `episode_transcript_content` | `{url}` → 6 段带 `startMs` 的文字稿 |
| 关注 | `following_updates_list` | `{}` → 3 条听友推荐动态（含 story 推荐语） |
| 订阅 | `subscription_often_played` | `{limit}` → 6 个常听节目（前端截 5） |
| 订阅 | `subscription_star` | `{}` → 星标节目（模块内可变 Set，初始取 fixture 的 subscriptionStar） |
| 订阅 | `subscription_star_update` | `{pid, withStar}` → `{}`，同时更新 mock 星标 Set |
| 播放 | `episode_played_history_list` | `{}` → 最近收听 1 条（mock-eid） |
| 播放 | `playback_progress_list` | `{eids}` → mock 进度（mock-eid = 120s） |
| 播放 | `playback_progress_update` | `{data}` → null，同时更新 mock 内存进度 |
| 播放 | `episode_played_create` | `{eid}` → null |
| 用户 | `profile` | `{data:<UserProfile>}` |
| 用户 | `pick_list_recent`（兼容 `pick_recent`） | 最近在听 4 条 |
| 认证 | `sendCode` | `{success:true,toast}` |
| 认证 | `login` | `{x-jike-access-token,x-jike-refresh-token,data:<user>}` |
| 认证 | `refresh_token` | 返回一对 mock token |

## 稳定性备注

- `mockLoginResponse` / `mockProfile` 与截图脚本里种入的 token 对齐：`mock-access-token`、
  `mock-refresh-token`；`AuthGuard` 在 `isMockEnabled()` 时也会种同样的 token。
- 主单集 `mock-eid`、主播客 `mock-pid` 是截图与人工验收的固定入口，
  评论/相关播客/富文本 shownotes 都以它们为最完整样本。
