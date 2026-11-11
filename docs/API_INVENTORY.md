# 小宇宙 API 清点 & 通知能力调研（2026-11-11）

> 目的：把「整个通知系统」缺的接口找出来，顺带摸清小宇宙 3.4.2 已有哪些、我们的 xyz 后端（pin 在 `22cfe78`）还没代理的新能力。
> 结论先行：**互动通知列表接口已确认存在且已补上**（后端补丁 `backend-patches/notification-endpoints.patch`，
> 前端 `/inbox` 通知 tab 已接入）；**真实抓包也已完成**（改包版 3.4.2 登录测试账号后人工巡检全站）：
> 共抓到 **116 个 API 端点**，xyz 覆盖 42 个、**74 个未代理**，通知真实合同（action=LIKE/COMMENT、source/target、
> v2 收件箱、已读语义）已校准。完整清单见 [`CAPTURE_ENDPOINTS_2026-11-11.md`](CAPTURE_ENDPOINTS_2026-11-11.md)，
> 静态缺口全表见 [`API_GAP.md`](API_GAP.md)。

## 1. 方法与数据来源

- 测试机：Xiaomi `22041211AC`（Android 14，SDK 34），小宇宙 `app.podcast.cosmos` 版本 `3.4.2`（versionCode 2017）。
- 从测试机 `adb pull` 出 `base.apk`（63.9 MB，**单 APK**，仅 `arm64-v8a`，`minSdk 28 / targetSdk 30`）。
- `apktool 2.11.1` 解码后，APK 的 Remote API 层**没有被混淆**（`io.iftech.android.podcast.remote.defaultapi.*Api` + `remote/model/*`），可静态读出：
  - 接口路径（`const-string "/notice/list"` 等）
  - 请求体参数名（`{loadMoreKey}`、`{eids}` 等）
  - 响应模型类与字段
- 基线：从 `D:\work\xyz-backend\handlers\*.go` 提取 `constant.BaseUrl + "...“` 得到 xyz 已代理的 64 条上游路径。
- 原始产物（本机）：`D:\work\captures\api-inventory.json`（294 条 API 方法）、`dex-paths.txt`（311 条路径串）、`dex-models.txt`（523 个模型类）、`unpacked/`（解码工程）。

**统计**：APK 3.4.2 共解析出 **294** 个 API 方法/端点；xyz `22cfe78` 覆盖其中 **64** 条上游路径；**约 195 条 API 未被 xyz 代理**（含通知相关）。

## 2. 通知 / 消息相关接口合同（静态确认）

### 2.1 互动通知列表（**新，xyz 未代理**）

```
POST https://api.xiaoyuzhoufm.com/v1/notice/list
body: { loadMoreKey?: <上一页返回的 loadMoreKey> }
resp: { data: NoticeInfo[], loadMoreKey?: object }
```

`remote/model/NoticeInfo` 字段（Gson 直接用字段名）：

| 字段 | 类型 | 说明（推断） |
|---|---|---|
| `id` | String | 通知 id |
| `uid` | String | 触发通知的用户 uid |
| `action` | String | 通知类型（对应 App 的 Like / Reply / Follow / Unknown；Story 另有类型） |
| `source` | TypeData（多态） | 来源实体（评论 / 单集 / 用户…） |
| `target` | TypeData（多态） | 目标实体 |
| `createdAt` | Date | 时间 |
| `blockable` / `blocked` | boolean | 是否可屏蔽 / 已屏蔽 |

App 侧渲染类：`app/notice/view/list/viewholder/NoticeLikeVH`、`NoticeReplyVH`、`NoticeFollowVH`、`NoticeUnknownVH`；另有 `app/viewholder/notice/.../presenter/StoryNoticePresentationKt`（Story 通知）。
`TypeData` 是接口类型（多态反序列化），**各 type 的具体实体结构需要抓包确认**。

### 2.2 未读数（已有 xyz 代理）

```
POST /v1/unread-count/get
resp: { data: { campaignId: String?, unreadCount: int, extra: Map<String,String>? } }
```
（xyz `/unread_count` 目前只透传了数字；`extra` 里可能还有分类型未读信息，待抓包确认。）

### 2.3 收件箱（已有 xyz `/inbox_list`，只读）

```
POST /v1/inbox/list     body { loadMoreKey? }   resp { data: Episode[], loadMoreKey?, userStats? }
POST /v1/inbox/remove   body { eids: [String] }  ← 已读/移除（**新，xyz 未代理**）
```

### 2.4 系统通知（**新**）

```
POST /api/systemNotice/systemNotice/list
POST /api/systemNotice/unread/get      → { data: CampaignsUnRead[] }（含 campaignId/未读）
```

### 2.5 其他相关

| 路径 | 说明 |
|---|---|
| `/blocked-notice/create` / `/blocked-notice/remove` | 屏蔽/取消屏蔽某类通知（body `{id}`） |
| `/like/list` | 某条评论/单集的点赞人列表（body `{targetType, targetId, loadMoreKey}`） |
| `/personal-update/list-following-updates` | 关注的人的动态更新 |
| `/story-inbox/list`、`/story-inbox/summary` | 故事收件箱 |
| `/story/comment/list-primary`、`/story/reaction/react` 等 | 故事评论/互动（通知来源） |

### 2.6 静态调查的边界（必须抓包验证）

- `/notice/list` 的 `source` / `target` 的 `TypeData` 具体结构、`action` 的枚举值。
- **已读语义**：API 层没有找到 `/notice/read` 之类的接口；打开消息页时未读数是否由服务端「拉列表即清零」，还是另有 WebSocket 通知，需要抓包对照 `/unread-count/get` 前后的变化。
- `loadMoreKey` 的真实结构（字符串还是对象）。
- 请求头是否对新端点有额外校验（xyz 现在统一伪装 iOS 2.57.1 头）。

## 3. 抓包环境现状（本机）

| 项 | 状态 |
|---|---|
| 测试机 adb | 在线（`adb devices` → `GYLVGIMFAEINMZPJ device`） |
| root | ❌ 无 `su`/Magisk，`ro.debuggable=0`，bootloader locked → 无法装系统证书 |
| 小宇宙网络配置 | `base-config` **只信任 system CA**；`debug-overrides` 才信任 user+system → 直接 MITM 会被 App 拒绝 |
| 证书固定 | 未发现 App 侧 pin：`CertificatePinner` 只出现在 OkHttp 库代码；`network_security_config` 无 `pin-set` |
| mitmproxy | ✅ 12.3.1 已安装，CA 已生成（`D:\work\captures\mitm\`） |
| APK 改造 | ✅ 已解码；方案：把 `network_security_config.xml` 的 `base-config` 改为信任我们的 CA（或内嵌 mitm CA 到 `res/raw`）+ 重新签名 |
| 待确认 | 改包版需**卸载原版**（会清空 App 数据）并重新登录测试账号（短信验证码） |

## 4. 新功能候选（APK 有、xyz 未代理，按领域）

- **故事 Story**：`story/*`、`story-inbox/*`、`story/comment/*`、`story/reaction/*`（小宇宙新动态形态）
- **AI 能力**：`ai-summary/user/list-history`、`episode-transcript/get`、`transcript/get-by-media-id`、`segment-feed/*`
- **播放列表**：`playlist/pull|push|patch`、`custom-playlist/config/get`
- **会员 / 付费**：`vip/*`、`wallet/*`、`pay/*`、`product-order/*`、`coupon/*`、`membership/*`
- **赞赏**：`appreciation/*`（含按 pid/uid 查询、状态、列表）
- **关注动态 / 订阅**：`personal-update/list-following-updates`、`subscription/list-often-played`、`subscription/search`、`subscription-push/update`
- **内容发现**：`discovery-feed/*`、`discovery-episode-feed/list`、`tab/discovery|featured|category/list`、`category-feed/*`、`topic/*`
- **评论增强**：`comment/list-thread/v2`、`comment/list-mine`、`comment/pin/update`、`comment/order/update`、`comment/pick/*`、`vote/*`
- **其他**：`weekly-letter/*`、`monthly-wrapped/*`、`teen-mode/*`、`app-theme/*`、`playback-rate-backup/*`、`episode-played/list-by-ids`、`episode-video/playback/get`、`reaction/*`

## 5. 实施顺序与状态（2026-11-11）

1. **P0 通知中心补全 —— ✅ 已完成**：xyz 补丁 9 条代理路由（通知 4 条 + 首页 tab 3 条 + 相关单集 1 条 +
   收件箱 v2 1 条），前端消息页双 tab + 收件箱 v2/全部已读、发现页 X 式内容流、单集页相关单集；字段已用真实抓包校准。
2. **P1 接口清点 —— ✅ 已完成**：静态 APK × xyz 覆盖 × 前端已用对照（见 [`API_GAP.md`](API_GAP.md)），
   真实抓包全站清点见 [`CAPTURE_ENDPOINTS_2026-11-11.md`](CAPTURE_ENDPOINTS_2026-11-11.md)（116 个 API 端点，74 个 xyz 未代理）。
3. **P2 收尾（2026-11-11 本轮结束）**：已完成评论增强（回复 v2 / 我的评论 / 时点评论面板）、AI 摘要与文字稿、
   关注动态 / 常听节目、星标订阅、播放现场同步 / 续听。剩余 backlog：
   - 播放列表：缺 `playlist/pull` 读取契约（只有 `playlist/patch`），需补抓；
   - 故事收件箱 / 周报：抓包为空或字段缺失，需补抓；
   - 系统通知 UI：xyz 路由已备，上游字段未校准，暂缓；
   - 运营广告位（flash-screen / flash-mob）：主动不做。

## 6. 抓包环境记录（备查）

- 测试机：Xiaomi `22041211AC`（Android 14，未 root，bootloader locked）。
- 改包流程：APK 3.4.2 → 信任内嵌 mitmproxy CA + 把 `res/values/strings.xml` 的
  `resource_signature_sha1` 改成 debug 证书 SHA1（绕过 `IfSignature` 防重打包退出）→ apktool 重打包 + apksigner 签名。
- 抓包：mitmproxy 12.3.1（`adb reverse tcp:18080` + 系统代理），全站巡检 1797 条 flow；
  原始数据在 `D:\work\captures\flows-tour.mitm`。

## 7. 已落地映射（xyz 补丁 9 条路由 → 前端）

| xyz 路由 | 上游 | 前端使用 |
|---|---|---|
| `/notice_list` | `/v1/notice/list` | `src/api/notice.ts` · 消息页通知 tab |
| `/inbox_remove` | `/v1/inbox/remove` | `src/api/inbox.ts` · 收件箱「全部标为已读」 |
| `/system_notice_list` | `/api/systemNotice/systemNotice/list` | 暂未接 UI |
| `/system_notice_unread` | `/api/systemNotice/unread/get` | 暂未接 UI |
| `/inbox_list_v2` | `/v2/inbox/list` | `src/api/inbox.ts` · 消息页收件箱 tab |
| `/tab_featured_list` | `/v1/tab/featured/list` | `src/api/homeFeed.ts` · 首页精选 tab |
| `/tab_discovery_list` | `/v1/tab/discovery/list` | `src/api/homeFeed.ts` · 首页发现 tab |
| `/tab_category_list` | `/v1/tab/category/list` | `src/api/homeFeed.ts` · 首页分类 tab |
| `/related_episode_list` | `/v1/related-episode/list` | `src/api/episode.ts` · 单集页相关单集 |
| `/comment_list_thread_v2` | `/v1/comment/list-thread/v2` | `src/api/comment.ts` · 单集页回复列表 |
| `/comment_list_mine` | `/v1/comment/list-mine` | `src/api/comment.ts` · 我的评论页 `/my-comments` |
| `/comment_list_timestamp_primary` | `/v1/comment/list-timestamp-primary` | `src/api/comment.ts` · 时点标记 |
| `/comment_get` | `GET /v1/comment/get?commentId=` | `src/api/comment.ts` · 时点评论正文 |
| `/ai_summary_episode_retrieve_brief` | `/v1/ai-summary/episode/retrieve-brief` | `src/api/episode.ts` · 单集页 AI 摘要 |
| `/episode_transcript_get` | `/v1/episode-transcript/get` | `src/api/episode.ts` · 文字稿元数据 |
| `/episode_transcript_content` | CDN `transcript.xyzcdn.net`（后端受限代理） | `src/api/episode.ts` · 文字稿正文 |
| `/following_updates_list` | `/v1/personal-update/list-following-updates`（真实抓包是 POST） | `src/api/following.ts` · 关注动态页 `/following` |
| `/subscription_often_played` | `/v1/subscription/list-often-played` | `src/api/subscription.ts` · 订阅页「常听节目」 |
| `/subscription_star` | `/v1/subscription-star/list`（xyz 内置路由） | `src/api/subscription.ts` · 订阅页「星标」tab |
| `/subscription_star_update` | `/v1/subscription-star/update`（xyz 内置路由） | `src/api/subscription.ts` · 星标切换 |
| `/playback_progress_list` | `/v1/playback-progress/list` | `src/api/playback.ts` · 跨端续听恢复 |
| `/playback_progress_update` | `/v1/playback-progress/update` | `src/api/playback.ts` · 播放进度上报 |
| `/episode_played_create` | `/v1/episode-played/create` | `src/api/playback.ts` · 记录开始收听 |
| `/episode_played_history_list` | `/v1/episode-played/list-history`（xyz 内置路由） | `src/api/playback.ts` · 最近收听 |

补丁文件：`backend-patches/notification-endpoints.patch`（21 条路由，16393 B，`backend.Dockerfile` 构建时 apply）。
