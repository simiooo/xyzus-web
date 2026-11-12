# 接口契约（xyz v1.10.3 / commit `22cfe78`，2026-11-10 实测）

> 面向开发者 / 维护者。请求链路与归一化机制见 [ARCHITECTURE.md](ARCHITECTURE.md)；实测证据见 [VERIFICATION.md](VERIFICATION.md)；登录与功能细节见 [FEATURES.md](FEATURES.md)。

## 1. 响应信封与错误

- 成功：`HTTP 200` + `{"code":200,"msg":"OK","data":<上游 JSON 原样>}`。alova 拦截器返回 `data`。
- 业务失败：`HTTP <code>` + `{"code":<code>,"msg":"…","data":<detail>}`（中文 msg 直接透传给用户）。
- **鉴权实测（与早期调研结论不同，以实测为准）**：
  | 场景 | 后端行为 |
  |---|---|
  | 完全**没带** `x-jike-access-token` | `HTTP 400` `{"code":400,"msg":"错误请求"}`（`CheckAccessToken` 中间件直接返回，**不是 401**） |
  | 带了但**失效/非法** token（上游拒绝） | `HTTP 401` `{"code":401,"msg":"身份认证信息失效…"}` |
  | 401 处理 | 客户端自动 `/refresh_token` → 重试 → 仍失败则清 token 跳登录 |

## 2. 端点总表（客户端 api 函数 → 后端真实要求 → 归一化后返回 → 验证）

图例（证据）：
- `A` = 无 token POST → **HTTP 400** `{"code":400,"msg":"错误请求"}`。
- `B` = 带假 token + 合法 body → **HTTP 401** `{"code":401,…}`：说明**路由存在、body 绑定通过、已走到上游鉴权**。
- `C` = 带假 token + **旧/错误 body** → HTTP 400（契约错误的直接证据）。
- `D` = 旧路由不存在 → `HTTP 404 page not found`。
- 返回 `200` 的**真实数据形状**无法验证（没有真实账号 token），依据 xyz v1.10.3 handler 源码与 `D:\work\xyz-backend\doc\docs\*.md` 响应示例。

| 端点（全部 POST） | 客户端入参（`src/api/*.ts`） | 后端真实要求（`D:\work\xyz-backend\handlers\*.go`） | 客户端归一化后返回 | 验证 |
|---|---|---|---|---|
| `/sendCode` | `{mobilePhoneNumber, areaCode}` | 上游 podcaster-api `/v1/auth/send-code`（**已关闭，实际 404**） | `SendCodeResult` | 任意参数都 404（见 FEATURES.md 登录） |
| `/login` | `{mobilePhoneNumber, verifyCode, areaCode}` | 上游 `/v1/auth/login-with-sms`（**已关闭，实际 404**） | `LoginSession{accessToken, refreshToken, user}` | 任意参数都 404（见 FEATURES.md 登录） |
| `/refresh_token` | `{'x-jike-access-token','x-jike-refresh-token'}` | body 必须带两个 token；上游 `/app_auth_tokens.refresh` | `LoginSession`（新 token） | 假 token → **401** (`B`) |
| `/profile` | `{}`（仅头带 access token） | body 无要求；上游 `/v1/profile/get` | `UserProfile`（裸对象） | 假 token → **401** (`B`)；无 token → 400 (`A`) |
| `/top_list` | `{category:'HOT'\|'ROCK'\|'NEW'}` | body `{category}`；xyz 映射 HOT→`HOT_EPISODES_IN_24_HOURS`、ROCK→`SKYROCKET_EPISODES`、NEW→`NEW_STAR_EPISODES` | `EpisodeBasic[]`（从 `data.data.items[].item` 摊平） | 缺 category → 400；带 category + 假 token → **401** (`B`) |
| `/editor_pick_list_history` | `{loadMoreKey?}` | body 同左；上游 `/v1/editor-pick/list-history` | `{items: EditorPickGroup[{date,picks}], loadMoreKey?}` | 假 token → **401** (`B`) |
| `/pilot_discovery_list` | `{loadMoreKey?}` | body 同左；上游 `/v1/pilot-discovery/list` | `EpisodeBasic[]`（`items[].episode` 摊平） | 假 token → **401** (`B`) |
| `/podcast_detail` | `{pid}` | body `{pid}`（上游 `/v1/podcast/get`） | `PodcastBasic`（裸对象） | 假 token → **401** (`B`) |
| `/episode_list` | `{pid, order:'asc'\|'desc', loadMoreKey?:{pubDate,id,direction}}` | body 同左 | `{items: EpisodeBasic[], loadMoreKey?, total?}` | 假 token → **401** (`B`) |
| `/podcast_related` | `{pid}` | body `{pid}` | `PodcastRelatedItem[]`（`{podcast}`） | 假 token → **401** (`B`) |
| `/podcast_get_info` | `{pid}` | body `{pid}` | `{ipLoc?, organization?}` | 假 token → **401** (`B`) |
| `/episode_detail` | `{eid}` | body `{eid}` | `EpisodeDetail`（裸对象） | 假 token → **401** (`B`) |
| `/episode_list_by_filter` | `{pid}`（旧代码多传 filter，后端忽略） | 后端**只要求 `{pid}`** | `EpisodeBasic[]` | 假 token → **401** (`B`) |
| `/favorite_episode_update` | `{eid, favorited}` | body `{eid, favorited}` | 无（`unknown`） | 假 token → **401** (`B`) |
| `/favorite_episode_list` | `{}` | **无分页参数**（后端空 map，上游 `/v1/favorite/list` 也不收） | `EpisodeBasic[]`（全量） | 假 token → **401** (`B`) |
| `/private_media_get` | `{eid}` | body `{eid}`；上游 GET `/v1/private-media/get?dubbing=false&eid=` | `{url,key?,ttl?}` | 缺 eid → 400；带 eid + 假 token → **401** (`B`) |
| `/search` | `{keyword, type, pid?, loadMoreKey?}` | body 同左；上游 `/v1/search` | `{items: SearchRawItem[], loadMoreKey?, highlightWord?}` | 假 token → **401** (`B`) |
| `/search_preset` | `{}` | body 空 | `SearchPresetItem[]` | 假 token → **401** (`B`) |
| `/comment_primary` | **`{id:<eid>, order, loadMoreKey?}`**（owner 由 api 层拼） | **必须** `{owner:{id:<eid>,type:"EPISODE"}, order, loadMoreKey?}` | `{items: Comment[], loadMoreKey?, totalCount?}` | **旧 body `{id,order}` → HTTP 400 (`C`)；新 body → HTTP 401 (`B`)，契约已修** |
| `/comment_thread` | `{primaryCommentId, order, loadMoreKey?}` | body 同左 | `{items: Comment[], loadMoreKey?}` | 假 token → **401** (`B`) |
| `/comment_collect_list` | `{}` | body 空；上游返回 `{data:[...],loadMoreKey}` | `{items: Comment[], loadMoreKey?}`（旧类型写成 `Comment[]` 是错的） | 假 token → **401** (`B`) |
| `/comment_create` | `{id:<eid>, type:'EPISODE', text, replyToCommentId?}` | 后端把 id 映射为 `owner:{id,type}`；回复时 `replyToCommentId` 传被回复评论 id | `Comment` | 假 token → **401** (`B`) |
| `/comment_like_update` | `{id, liked, type:'COMMENT'\|'PICK'}` | body 同左 | 无 | 假 token → **401** (`B`) |
| `/comment_remove` | `{commentId}` | body `{commentId}` | 无 | 假 token → **401** (`B`) |
| `/comment_collect_create` / `_remove` | `{commentId}` | body `{commentId}` | 无 | 假 token → **401** (`B`) |
| `/category_list` | `{}` | body 空；上游 `/v1/category/list-all` | `CategoryInfo[]` | 假 token → **401** (`B`) |
| `/category_list_tab` | `{categoryId}` | 必填 `{categoryId}` | `CategoryTab[]` | 假 token → **401** (`B`) |
| `/category_podcast_list` | `{categoryId, tab, loadMoreKey?:number}` | 必填 `categoryId`+`tab`；`loadMoreKey` 是 **int**（旧类型 string 是错的） | `{items: CategoryPodcastItem[], loadMoreKey?:number}` | 假 token → **401** (`B`) |
| `/subscription` | `{uid?, loadMoreKey?:{skip:number}}` | body 同左（后端补 limit/sort/uid）；上游 `/v1/subscription/list` | `{items: PodcastBasic[], loadMoreKey?:{skip}}` | 假 token → **401** (`B`) |
| `/subscription_update` | `{pid, mode:'ON'\|'OFF'}` | body 同左 | 无 | 假 token → **401** (`B`) |
| `/inbox_list` | `{loadMoreKey?:{pubDate,id}}` | body 同左；xyz 固定传 `limit:"20"`，上游 `/v1/inbox/list` | `{items: EpisodeBasic[], loadMoreKey?:{pubDate,id}}` | 无 token → 400 (`A`)；假 token → **401** (`B`)；假 token + 游标 body → **401**（body 绑定通过） |
| `/unread_count` | `{}` | body 空；上游 `/v1/unread-count/get` | `number`（只有数量，没有内容） | 无 token → 400 (`A`)；假 token → **401** (`B`) |
| `/inbox_list_v2` | `{limit?, loadMoreKey?}` | xyz 补丁代理上游 `/v2/inbox/list` | `{items: EpisodeBasic[], loadMoreKey?, userStats}` | 无 token → 400；假 token → **401**（上游日志 `/v2/inbox/list`） |
| `/tab_featured_list` | `{loadMoreKey?, returnAll?, forceRefresh?}` | xyz 补丁代理上游 `/v1/tab/featured/list` | 原始板块数组（页面容错渲染） | 假 token → **401** |
| `/tab_discovery_list` | `{loadMoreKey?, returnAll?, forceRefresh?}` | xyz 补丁代理上游 `/v1/tab/discovery/list` | 原始板块数组（页面容错渲染） | 假 token → **401** |
| `/tab_category_list` | `{loadMoreKey?}` | xyz 补丁代理上游 `/v1/tab/category/list` | 原始板块数组（页面容错渲染） | 假 token → **401** |
| `/related_episode_list` | `{eid}` | xyz 补丁代理上游 `/v1/related-episode/list` | `EpisodeBasic[]` | 假 token → **401** |
| `/comment_list_thread_v2` | `{primaryCommentId, order:"SMART"}` | xyz 补丁代理上游 `/v1/comment/list-thread/v2` | `{items: Comment[], totalCount}` | 真实 token → **200** |
| `/comment_list_mine` | `{order:"TIME"\|"LIKE", limit?}` | xyz 补丁代理上游 `/v1/comment/list-mine` | `MyComment[]`（每条带 episode） | 真实 token → **200** |
| `/comment_list_timestamp_primary` | `{owner:{id,type:"EPISODE"}, from, to}` | xyz 补丁代理上游 `/v1/comment/list-timestamp-primary` | 时点标记 `{id,timestamp,type}[]` | 真实 token → **200**（窗口内有标记） |
| `/comment_get` | `{commentId}` | xyz 补丁代理上游 `GET /v1/comment/get?commentId=` | 单条 `Comment` | 真实 token → **200**（标记 → 评论正文） |
| `/ai_summary_episode_retrieve_brief` | `{eid}` | xyz 补丁代理上游 `/v1/ai-summary/episode/retrieve-brief` | `{requested, summary:{status,brief}\|null}` | 真实 token → **200**（ready / brief 93 字） |
| `/episode_transcript_get` | `{eid, mediaId}` | xyz 补丁代理上游 `/v1/episode-transcript/get` | `{key, vendorDeclaration, transcriptUrl, highlightUrl}` | 真实 token → **200** |
| `/episode_transcript_content` | `{url:<transcriptUrl>}` | xyz 本地代理 CDN（只允许 transcript.xyzcdn.net） | `[{text, startMs}]` | 真实 token → **200**（787 段） |
| `/following_updates_list` | `{}` | xyz 补丁代理上游 `/v1/personal-update/list-following-updates`（真实抓包是 POST） | `{items: FollowingUpdate[], showSticker}` | 真实 token → **200**（1 条动态） |
| `/subscription_often_played` | `{limit?}` | xyz 补丁代理上游 `/v1/subscription/list-often-played` | `PodcastBasic[]` | 真实 token → **200**（3 个节目） |
| `/subscription_star` | `{}` | xyz 内置代理上游 `/v1/subscription-star/list` | `PodcastBasic[]`（无分页） | 真实 token → **200**（1 个星标节目） |
| `/subscription_star_update` | `{pid, withStar}` | xyz 内置代理上游 `/v1/subscription-star/update` | `{}` | 真实 token → **200**（星标/取消星标实测并已还原） |
| `/playback_progress_list` | `{eids:[...]}` | xyz 补丁代理上游 `/v1/playback-progress/list` | `{eid,pid,progress,playedAt}[]` | 真实 token → **200**（跨端续听恢复） |
| `/playback_progress_update` | `{data:[{eid,pid,playedAt,progress}]}` | xyz 补丁代理上游 `/v1/playback-progress/update` | `{}` | 真实 token → **200**（写完 list 可见；旧 `playedAt` 被服务端拒绝） |
| `/episode_played_create` | `{eid}` | xyz 补丁代理上游 `/v1/episode-played/create` | `{}` | 真实 token → **200** |
| `/episode_played_list_for_cache` | `{version?, loadMoreKey?}` | xyz 补丁代理上游 `/v1/episode-played/list-for-cache` | `{data: PlayedHistory[], version, needRefresh, loadMoreKey?}` | mock 浏览器实测（增量同步，见 FEATURES.md）；真实上游待测 |
| `/episode_played_history_list` | `{}` | xyz 内置代理上游 `/v1/episode-played/list-history` | `[{episode,recentAudiences}]` | 真实 token → **200** |
| `/notice_list` | `{loadMoreKey?}` | xyz 补丁代理上游 `/v1/notice/list`（请求头模板同 notice.go） | `{items: Notice[], loadMoreKey?}`（静态合同，待抓包校准） | 无 token → 400；假 token → **401**（上游日志 `/v1/notice/list`） |
| `/inbox_remove` | `{eids: string[]}` | xyz 补丁代理上游 `/v1/inbox/remove` | 无（UI 暂未接） | 无 token → 400；假 token → **401** |
| `/system_notice_list` | `{loadMoreKey?}` | xyz 补丁代理上游 `/api/systemNotice/systemNotice/list` | 无（UI 暂未接） | 假 token → **401** |
| `/system_notice_unread` | `{}` | xyz 补丁代理上游 `/api/systemNotice/unread/get` | 无（UI 暂未接） | 假 token → **401** |
| `/pick_list_recent` | `{uid}` | body `{uid}`；上游 `/v1/pick/list-recent` | `PickRecentItem[]` | 旧路由 `/pick_recent` → **HTTP 404 (`D`)**；新路由 + 假 token → **401** (`B`) |

共 57 个客户端实际使用的端点；其中 56 个用真实 HTTP 打过路由/参数绑定（A/B/C/D 共 89 次探测，见 [VERIFICATION.md](VERIFICATION.md)），
新增的 `/episode_played_list_for_cache` 经 mock 浏览器实测（真实上游待测，见 [FEATURES.md](FEATURES.md)）。

## 3. 修复的三个硬错误（修复前 → 修复后）

| # | 问题 | 修复前 | 修复后 | 实测证据 |
|---|---|---|---|---|
| 1 | `/comment_primary` 请求体缺 `owner` | `{id, order}` → HTTP 400「错误请求」，评论 100% 挂 | api 层拼 `{owner:{id:<eid>,type:'EPISODE'}, order, loadMoreKey?}`，页面仍调 `commentPrimaryAPI({id, order})` | 旧 body **400** / 新 body **401**（VERIFICATION.md） |
| 2 | `/top_list` 解包错误 | 把 `data.data.items` 当 `EpisodeBasic[]` 直接 `.map` → 崩 | `unwrapPage().items.map(unwrapItem)` → `EpisodeBasic[]` | 带 category → **401**（body 绑定通过）；形状取自 `doc/docs/topList.md`：`data.data.items[{item:{…}}]` |
| 3 | `/pick_recent` 路由不存在 | 请求 404 | 改为 `/pick_list_recent`，body `{uid}` | 旧路由 **404 page not found** / 新路由 **401**（VERIFICATION.md） |

## 4. 其它归一化修复

- `/subscription`：`{data:[…]}` 与 `{data:{data:[…]}}` 双包裹都兼容 → `{items, loadMoreKey?}`。
- `/comment_collect_list`：真实是 `{data:[…], loadMoreKey}`（旧类型 `Comment[]`）→ `{items, loadMoreKey?}`。
- `/favorite_episode_list`、`/category_list`、`/search`、`/search_preset`、`/pilot_discovery_list`、`/editor_pick_list_history`：`data.data` 包裹统一在 api 层吃掉。
- `/category_podcast_list` 的 `loadMoreKey` 由 `string` 修正为 `number`（后端 `LoadMoreKey int`）。
- `/profile`、`/podcast_detail`、`/episode_detail`、`/private_media_get` 等对象端点统一返回裸对象。
- `/refresh_token` 请求体保持 `{两个 token}`（后端 `ShouldBind` 读 body，不是 header）；客户端解析 `data["x-jike-access-token"]` 正确，并兼容再包一层 `data` 的版本。