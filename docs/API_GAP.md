# 小宇宙 API 缺口对照（APK 3.4.2 × xyz 22cfe78 × xyz-web）

> **状态（2026-11-11）**：通知相关缺口（`/notice/list`、`/inbox/remove`、`/systemNotice/*`）已由
> `backend-patches/notification-endpoints.patch` 补上，前端消息页已接 `/notice_list`；本表其余数据仍是
> APK 静态覆盖率统计，作为后续「挑新功能」的优先级依据。

> 数据来源：APK 静态解析 `D:\work\captures\api-inventory.json`（294 个 API 方法）+ `D:\work\xyz-backend` 源码 + `src/api/*.ts` 实际调用。
> 说明：路径已做规范化（去掉 `/v1/`、query、尾斜杠）；过滤了把日志文案误当路径的脏数据。

- APK 唯一上游路径：**270** 条
- xyz 已代理：**52** 条；未代理：**218** 条
- 前端已使用的 xyz 路由：**29** 个

## 1. 通知相关接口（P0）

| 上游路径 | xyz 路由 | 前端已用 | APK 方法数 | 状态 |
|---|---|---|---|---|
| `/api/systemNotice/systemNotice/list` | `—` | — | 1 | ❌ 需补后端 |
| `/api/systemNotice/unread/get` | `—` | — | 2 | ❌ 需补后端 |
| `/inbox/list` | `/inbox_list` | ✅ | 1 | ✅ 已覆盖 |
| `/inbox/remove` | `—` | — | 1 | ❌ 需补后端 |
| `/like/list` | `—` | — | 1 | ❌ 需补后端 |
| `/notice/list` | `—` | — | 1 | ❌ 需补后端 |
| `/onboarding/inbox/get-prompt` | `—` | — | 1 | ❌ 需补后端 |
| `/personal-update/claim-sticker` | `—` | — | 1 | ❌ 需补后端 |
| `/personal-update/list-following-updates` | `—` | — | 1 | ❌ 需补后端 |
| `/personal-update/list-recommend-cards` | `—` | — | 1 | ❌ 需补后端 |
| `/story-inbox/list` | `—` | — | 1 | ❌ 需补后端 |
| `/story-inbox/summary` | `—` | — | 1 | ❌ 需补后端 |
| `/unread-count/get` | `/unread_count` | ✅ | 1 | ✅ 已覆盖 |

## 2. xyz 已代理、但前端还没接的接口（后端能力闲置）

共 31 个 xyz 路由。做新功能时优先从这里挑，成本最低。

| xyz 路由 | 上游路径 |
|---|---|
| `/blocked_user_create` | `/blocked-user/create` |
| `/blocked_user_lists` | `/blocked-user/list` |
| `/blocked_user_remove` | `/blocked-user/remove` |
| `/category_podcast_list` | `/category/podcast/list-by-tab` |
| `/discovery` | `/discovery-feed/list` |
| `/editor_pick_list_history` | `/editor-pick/list-history` |
| `/episode_clap` | `/clap/list` |
| `/episode_clap_create` | `/clap/create` |
| `/episode_live_count` | `/live-stats/episode/get` |
| `/episode_played_history_list` | `/episode-played/list-history` |
| `/favorite_episode_list` | `/favorite/list` |
| `/follower_list` | `/user-relation/list-follower` |
| `/following_list` | `/user-relation/list-following` |
| `/live_stats_report` | `/live-stats/report` |
| `/mileage_get` | `/mileage/get` |
| `/mileage_list` | `/mileage/list` |
| `/owned_podcasts` | `/podcaster/owned-podcasts` |
| `/pick_list_history` | `/pick/list-history` |
| `/played_list` | `/episode-played/list` |
| `/podcast_bulletin` | `/podcast-bulletin/get-by-pid` |
| `/refresh_episode_recommend` | `/discovery-collection/refresh-episode-recommend` |
| `/relation_update` | `/user-relation/update` |
| `/sticker` | `/sticker/list` |
| `/sticker_board` | `/sticker/get-board` |
| `/subscription` | `/subscription/list` |
| `/subscription_non_starred` | `/subscription/list-non-starred` |
| `/subscription_star` | `/subscription-star/list` |
| `/subscription_star_update` | `/subscription-star/update` |
| `/user_preference_get` | `/user-preference/get` |
| `/user_preference_update` | `/user-preference/update` |
| `/user_stats` | `/user-stats/get` |

## 3. 未代理路径全表（按模块分组）

### 故事 Story（17 条）

- `/story/comment/create` — 2 个方法
- `/story/comment/get-transcript` — 1 个方法
- `/story/comment/list-primary` — 1 个方法
- `/story/comment/list-thread` — 1 个方法
- `/story/comment/remove` — 1 个方法
- `/story/create` — 1 个方法
- `/story/delete` — 1 个方法
- `/story/list` — 1 个方法
- `/story/list-mine` — 1 个方法
- `/story/list-viewers` — 1 个方法
- `/story/permission` — 1 个方法
- `/story/prepare` — 1 个方法
- `/story/reaction/react` — 1 个方法
- `/story/recommendation/feedback` — 1 个方法
- `/story/suggest-episodes` — 1 个方法
- `/story/suggest-follows` — 1 个方法
- `/story/view` — 1 个方法

### 评论增强（12 条）

- `/comment/bottom/update` — 1 个方法
- `/comment/get` — 1 个方法
- `/comment/get-earliest-timestamp-primary` — 1 个方法
- `/comment/hide` — 1 个方法
- `/comment/list-mine` — 1 个方法
- `/comment/list-thread/v2` — 1 个方法
- `/comment/list-timestamp-primary` — 1 个方法
- `/comment/order/update` — 1 个方法
- `/comment/pick/create` — 1 个方法
- `/comment/pick/list` — 1 个方法
- `/comment/pick/remove` — 1 个方法
- `/comment/pin/update` — 1 个方法

### 播客主后台（9 条）

- `/podcaster/episode/list-latest` — 1 个方法
- `/podcaster/podcast/appreciation/get-card` — 1 个方法
- `/podcaster/podcast/create` — 1 个方法
- `/podcaster/podcast/get` — 1 个方法
- `/podcaster/podcast/list` — 1 个方法
- `/podcaster/podcast/live-stats/get` — 1 个方法
- `/podcaster/podcast/remove` — 1 个方法
- `/podcaster/podcast/stats/get` — 1 个方法
- `/podcaster/subscriber/list-latest` — 1 个方法

### 赞赏（8 条）

- `/appreciation/create` — 2 个方法
- `/appreciation/episode/check-appreciated` — 1 个方法
- `/appreciation/get` — 1 个方法
- `/appreciation/get-info-by-pid` — 1 个方法
- `/appreciation/get-info-by-uid` — 1 个方法
- `/appreciation/get-status` — 1 个方法
- `/appreciation/list-episode-by-pid` — 1 个方法
- `/appreciation/list-podcast` — 1 个方法

### 登录/SSO（7 条）

- `/auth/loginAndAbortAccountCancellation` — 1 个方法
- `/auth/loginOrSignUp` — 1 个方法
- `/auth/loginOrSignUpWithSMS` — 1 个方法
- `/auth/loginOrSignUpWithSMSAndBindWechat` — 1 个方法
- `/auth/loginWithEmail` — 1 个方法
- `/auth/loginWithWechat` — 1 个方法
- `/auth/sendCode` — 1 个方法

### 账号绑定（6 条）

- `/bind/bind-jike` — 1 个方法
- `/bind/bindWithSMS` — 1 个方法
- `/bind/bindWithWechat` — 1 个方法
- `/bind/syncWechatBind` — 1 个方法
- `/bind/unbind-jike` — 1 个方法
- `/bind/unbindWechat` — 1 个方法

### 收藏增强（6 条）

- `/favorite/search` — 1 个方法
- `/favorite/time-point/add` — 1 个方法
- `/favorite/time-point/create-note` — 2 个方法
- `/favorite/time-point/list` — 1 个方法
- `/favorite/time-point/remove` — 1 个方法
- `/favorite/time-point/remove-note` — 1 个方法

### 分类（5 条）

- `/category/editor-pick/list-by-tab` — 1 个方法
- `/category/editor-pick/list-tabs` — 1 个方法
- `/category/episode/list-all` — 1 个方法
- `/category/list-daily-suggestion` — 1 个方法
- `/category/podcast/list-all` — 1 个方法

### 优惠券（5 条）

- `/coupon/check-applicable` — 1 个方法
- `/coupon/count` — 1 个方法
- `/coupon/list` — 1 个方法
- `/coupon/list-applicable` — 1 个方法
- `/coupon/list-unapplicable` — 1 个方法

### 订单（5 条）

- `/product-order/cancel` — 1 个方法
- `/product-order/continue` — 1 个方法
- `/product-order/create` — 2 个方法
- `/product-order/get` — 1 个方法
- `/product-order/get-latest-pending` — 1 个方法

### sticker（5 条）

- `/sticker/get-library` — 1 个方法
- `/sticker/list-sealed` — 1 个方法
- `/sticker/see-all-new` — 1 个方法
- `/sticker/unseal` — 1 个方法
- `/sticker/update-board` — 1 个方法

### 系统通知（4 条）

- `/api/oauth2/validateClient` — 1 个方法
- `/api/systemNotice/systemNotice/list` — 1 个方法
- `/api/systemNotice/unread/get` — 2 个方法
- `/api/users/saveDeviceInfo` — 1 个方法

### 收听历史（4 条）

- `/episode-played/get-last` — 1 个方法
- `/episode-played/list-by-ids` — 1 个方法
- `/episode-played/list-for-cache` — 1 个方法
- `/episode-played/remove` — 1 个方法

### 引导（4 条）

- `/onboarding/category/submit-interests` — 1 个方法
- `/onboarding/inbox/get-prompt` — 1 个方法
- `/onboarding/new-user/subscription-recommendation/list` — 1 个方法
- `/onboarding/survey/returning-user/check` — 1 个方法

### pick（4 条）

- `/pick/create` — 1 个方法
- `/pick/detect-emotion` — 1 个方法
- `/pick/get` — 1 个方法
- `/pick/remove` — 1 个方法

### 订阅增强（4 条）

- `/subscription/batch-update-by-co-eid` — 1 个方法
- `/subscription/get-opml` — 1 个方法
- `/subscription/list-often-played` — 1 个方法
- `/subscription/search` — 1 个方法

### AI 摘要（3 条）

- `/ai-summary/episode/retrieve-brief` — 1 个方法
- `/ai-summary/episode/retrieve-summary` — 1 个方法
- `/ai-summary/user/list-history` — 1 个方法

### 关注动态（3 条）

- `/personal-update/claim-sticker` — 1 个方法
- `/personal-update/list-following-updates` — 1 个方法
- `/personal-update/list-recommend-cards` — 1 个方法

### 互动（3 条）

- `/reaction/create` — 1 个方法
- `/reaction/list-by-id` — 1 个方法
- `/reaction/remove` — 1 个方法

### related-episode（3 条）

- `/related-episode/list` — 1 个方法
- `/related-episode/list-missed` — 1 个方法
- `/related-episode/mark-missed-as-read` — 1 个方法

### 发现页签（3 条）

- `/tab/category/list` — 1 个方法
- `/tab/discovery/list` — 1 个方法
- `/tab/featured/list` — 1 个方法

### 青少年模式（3 条）

- `/teen-mode/disable` — 1 个方法
- `/teen-mode/discovery-feed` — 1 个方法
- `/teen-mode/enable` — 1 个方法

### 话题（3 条）

- `/topic/get` — 1 个方法
- `/topic/list` — 1 个方法
- `/topic/list-episodes` — 1 个方法

### 账号（2 条）

- `/account/pre-remove-check` — 1 个方法
- `/account/remove` — 1 个方法

### 主题（2 条）

- `/app-theme/get` — 1 个方法
- `/app-theme/list` — 1 个方法

### category-daily（2 条）

- `/category-daily/get-ui-config` — 1 个方法
- `/category-daily/list` — 1 个方法

### 合集（2 条）

- `/collection/create` — 1 个方法
- `/collection/get` — 2 个方法

### 播放列表（2 条）

- `/custom-playlist/config/get` — 1 个方法
- `/custom-playlist/sports-radio/list` — 1 个方法

### 押金（2 条）

- `/deposit/create` — 1 个方法
- `/deposit/get` — 1 个方法

### discovery-episode-recommend（2 条）

- `/discovery-episode-recommend/exposure` — 1 个方法
- `/discovery-episode-recommend/list` — 1 个方法

### 单集增强（2 条）

- `/episode/get-for-long-press` — 1 个方法
- `/episode/list-by-ids` — 1 个方法

### episode-customization（2 条）

- `/episode-customization/brand-gift/check-availability` — 1 个方法
- `/episode-customization/get` — 1 个方法

### 转写（2 条）

- `/episode-transcript/feedback` — 1 个方法
- `/episode-transcript/get` — 1 个方法

### 快闪活动（2 条）

- `/flash-mob/get` — 1 个方法
- `/flash-mob/list` — 1 个方法

### 礼物（2 条）

- `/gift/claim` — 1 个方法
- `/gift/get-detail` — 1 个方法

### 会员（2 条）

- `/membership/platform/app-entry` — 1 个方法
- `/membership/platform/status` — 1 个方法

### 支付（2 条）

- `/payment/create-by-ifpay` — 1 个方法
- `/payment/get-status` — 1 个方法

### playback-rate-backup（2 条）

- `/playback-rate-backup/create` — 1 个方法
- `/playback-rate-backup/get` — 1 个方法

### product（2 条）

- `/product/discounted-price` — 1 个方法
- `/product/tip` — 1 个方法

### 用户资料（2 条）

- `/profile/update` — 1 个方法
- `/profile/update-with-wechat-info` — 1 个方法

### 推送 Token（2 条）

- `/push-token/create` — 1 个方法
- `/push-token/remove` — 1 个方法

### 搜索（2 条）

- `/search/get-express` — 1 个方法
- `/search/suggest` — 1 个方法

### 故事收件箱（2 条）

- `/story-inbox/list` — 1 个方法
- `/story-inbox/summary` — 1 个方法

### 投票（2 条）

- `/vote/get-by-eid` — 1 个方法
- `/vote/submit` — 1 个方法

### ab（1 条）

- `/ab/device/get-groups-mapping` — 1 个方法

### asset（1 条）

- `/asset/list` — 1 个方法

### balance（1 条）

- `/balance/get` — 1 个方法

### bean（1 条）

- `/bean/wallet/get` — 1 个方法

### beta（1 条）

- `/beta/list-env` — 1 个方法

### 分类流（1 条）

- `/category-feed/list` — 1 个方法

### censor（1 条）

- `/censor/create` — 1 个方法

### check（1 条）

- `/check/create` — 1 个方法

### collection-opml（1 条）

- `/collection-opml/get` — 1 个方法

### collection-subscription（1 条）

- `/collection-subscription/update` — 1 个方法

### content-feedback（1 条）

- `/content-feedback/create` — 1 个方法

### 发现流（1 条）

- `/discovery-episode-feed/list` — 1 个方法

### 发现流（1 条）

- `/discovery-feed/get-header` — 1 个方法

### discovery-tab-icon（1 条）

- `/discovery-tab-icon/get` — 1 个方法

### dismiss（1 条）

- `/dismiss/create` — 5 个方法

### editor-pick（1 条）

- `/editor-pick/list` — 1 个方法

### entity（1 条）

- `/entity/parse` — 1 个方法

### 收听历史（1 条）

- `/episode-finished/list-history` — 1 个方法

### episode-video（1 条）

- `/episode-video/playback/get` — 1 个方法

### exclusive-episode-recommendation（1 条）

- `/exclusive-episode-recommendation/get` — 1 个方法

### 闪屏（1 条）

- `/flash-screen/list` — 1 个方法

### import（1 条）

- `/import/create` — 1 个方法

### 收件箱（1 条）

- `/inbox/remove` — 1 个方法

### 点赞（1 条）

- `/like/list` — 1 个方法

### live-stats（1 条）

- `/live-stats/story/report` — 1 个方法

### 月度回顾（1 条）

- `/monthly-wrapped/get-prompt` — 1 个方法

### 音乐识别（1 条）

- `/music-detection/get` — 1 个方法

### 通知（1 条）

- `/notice/list` — 1 个方法

### operation-resource（1 条）

- `/operation-resource/list` — 1 个方法

### order（1 条）

- `/order/calculate-final-price` — 1 个方法

### podcast-bulletin（1 条）

- `/podcast-bulletin/get` — 1 个方法

### podcast-customization（1 条）

- `/podcast-customization/get` — 1 个方法

### podcaster-mute（1 条）

- `/podcaster-mute/create` — 1 个方法

### profile-completion-guide（1 条）

- `/profile-completion-guide/get` — 1 个方法

### qiniu（1 条）

- `/qiniu/provision` — 1 个方法

### 兑换码（1 条）

- `/redemption/create` — 1 个方法

### related-episode-recommend（1 条）

- `/related-episode-recommend/list` — 1 个方法

### 举报（1 条）

- `/report/create` — 6 个方法

### resource（1 条）

- `/resource/list` — 1 个方法

### 发现流（1 条）

- `/segment-feed/get/v2` — 1 个方法

### share（1 条）

- `/share/create` — 1 个方法

### submission（1 条）

- `/submission/create` — 1 个方法

### 订阅推送（1 条）

- `/subscription-push/update` — 1 个方法

### top-list（1 条）

- `/top-list/list` — 1 个方法

### transaction（1 条）

- `/transaction/list` — 1 个方法

### 转写（1 条）

- `/transcript/get-by-media-id` — 1 个方法

### user-config（1 条）

- `/user-config/get` — 1 个方法

### v2（1 条）

- `/v2` — 1 个方法

### volcengine（1 条）

- `/volcengine/provision` — 1 个方法

### 周报（1 条）

- `/weekly-letter/get-latest` — 1 个方法
