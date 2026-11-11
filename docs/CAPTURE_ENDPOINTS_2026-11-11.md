# 真实抓包：App 全站巡检接口清点（2026-11-11）

> 来源：改包版小宇宙 3.4.2 + mitmproxy 全流量抓包（登录测试账号后人工巡检全部页面/设置/搜索/详情）。
> 原始数据：`D:\work\captures\final-api-inventory.json`（116 个 API 端点，537 条 API flow）。
> 本文件中请求体/响应只保留结构，不包含用户内容与 token。

- 抓到 API 端点：**116** 个（method + path 去重）
- xyz 已代理：**42** 个；**未代理：74** 个
- 本次巡检才首次出现：84 个

## 0. 本机已落地的合同（通知相关）

- `POST /v1/notice/list`：body `{loadMoreKey?}`，响应 `{data: NoticeInfo[]}`；真实 action = `LIKE` / `COMMENT`；
  `LIKE` 触发者在 `source.users[0]`，`COMMENT` 在 `source.author`；被互动单集 eid = `target.owner.id`（type=EPISODE）；
  打开通知页后 `/v1/unread-count/get` 归 0（拉列表即已读）。
- 收件箱 App 实际用 `POST /v2/inbox/list`：body `{limit:25}`，响应 `{data: Episode[], userStats, loadMoreKey:{pubDate,id}}`；
  已读/移除用 `POST /v1/inbox/remove` body `{eids:[...]}` → `{}`。
  我们的 xyz `/inbox_list` 仍代理 v1；**v2 未代理**，是后续对齐 App 的候选。

## 通知 / 消息（7 个未代理端点）

| 方法 | 路径 | 次数 | 响应顶层 | 请求体样例 |
|---|---|---|---|---|
| POST | `/api/systemNotice/unread/get` | 3 | data | {"campaignIds":["5eba3da3499a33001846b928","602e02062d6175001810c165"]} |
| POST | `/v1/inbox/remove` | 4 | - | {"eids":["6ad4dacd641ef406308d86e5"]} |
| POST | `/v1/notice/list` | 2 | data | {} |
| POST | `/v1/personal-update/list-following-updates` | 1 | data, showSticker | {} |
| POST | `/v1/personal-update/list-recommend-cards` | 1 | data | {} |
| POST | `/v1/story-inbox/list` | 2 | data, hasCreated, hasCreatedIn48Hours | {} |
| POST | `/v1/story-inbox/summary` | 3 | data | {} |

## 评论（读）（4 个未代理端点）

| 方法 | 路径 | 次数 | 响应顶层 | 请求体样例 |
|---|---|---|---|---|
| GET | `/v1/comment/get` | 4 | data | - |
| POST | `/v1/comment/list-mine` | 4 | data | {"order":"TIME","limit":20} |
| POST | `/v1/comment/list-thread/v2` | 4 | data, totalCount | {"primaryCommentId":"688c2f475070644d30532f27","order":"SMART"} |
| POST | `/v1/comment/list-timestamp-primary` | 5 | data | {"owner":{"id":"6aed2f4b30b2f21e46cb37c1","type":"EPISODE"},"from":3047,"to":3167} |

## 首页 / 发现流（17 个未代理端点）

| 方法 | 路径 | 次数 | 响应顶层 | 请求体样例 |
|---|---|---|---|---|
| GET | `/brand-activity/general/info` | 1 | config, data | - |
| POST | `/v1/asset/list` | 1 | data | {"limit":25} |
| POST | `/v1/category-daily/get-ui-config` | 1 | data | {"categoryId":"6ad6d2953e6b4563b80c758c"} |
| POST | `/v1/category-daily/list` | 1 | data | {"categoryId":"6ad6d2953e6b4563b80c758c","limit":2} |
| POST | `/v1/discovery-episode-recommend/exposure` | 2 | - | {"episodeIds":["6af39f6c3caef3b52f53df6b","6accc5de195d838e2af0bd9a","6af2d9205b7c4709bfe3f837"],"sessionKey":"rt_a269ab |
| POST | `/v1/discovery-episode-recommend/list` | 2 | data | {"loadMoreKey":"rt_a269abcf-3aa1-4f99-b839-18ca10a8a37f"} |
| GET | `/v1/discovery-tab-icon/get` | 4 | data | - |
| POST | `/v1/flash-mob/list` | 3 | data | {} |
| POST | `/v1/flash-screen/list` | 3 | data | {} |
| GET | `/v1/new-power-collection/get-latest` | 1 | data | - |
| OPTIONS | `/v1/new-power-collection/get-latest` | 1 | - | - |
| OPTIONS | `/v1/new-power-collection/list-publish-date` | 1 | - | - |
| POST | `/v1/new-power-collection/list-publish-date` | 4 | data, total | {"skip":0,"limit":10} |
| POST | `/v1/operation-resource/list` | 1 | data | {"type":"PAY_PODCAST_RECOMMENDATION_BANNER"} |
| POST | `/v1/tab/category/list` | 2 | data | {"loadMoreKey":"episodeCategoryBlocks:10"} |
| POST | `/v1/tab/discovery/list` | 1 | data, loadMoreKey | {"returnAll":false,"forceRefresh":false} |
| POST | `/v1/tab/featured/list` | 8 | data | {"returnAll":false,"forceRefresh":false} |

## 单集 / 播客（16 个未代理端点）

| 方法 | 路径 | 次数 | 响应顶层 | 请求体样例 |
|---|---|---|---|---|
| POST | `/v1/ai-summary/episode/retrieve-brief` | 9 | data | {"eid":"6ad4dacd641ef406308d86e5"} |
| GET | `/v1/appreciation/episode/check-appreciated` | 5 | exist | - |
| POST | `/v1/appreciation/list-podcast` | 1 | data | {} |
| POST | `/v1/category/podcast/list-all` | 1 | data | {} |
| GET | `/v1/episode-customization/get` | 14 | data | - |
| POST | `/v1/episode-finished/list-history` | 1 | data, loadMoreKey | {"limit":20} |
| GET | `/v1/episode-played/get-last` | 1 | - | - |
| POST | `/v1/episode-played/list-by-ids` | 1 | data | {"ids":["6af47315c01b412e036ddb2f","6aed4bccc01b412e037619e2","6aed4b5bc01b412e0367fe8e","6ae6cf54c01b412e03c3cc64","6ad |
| POST | `/v1/episode-played/list-for-cache` | 3 | data, version, needRefresh | {} |
| POST | `/v1/episode-transcript/get` | 1 | data | {"eid":"6ad4dacd641ef406308d86e5","mediaId":"626b46ea9cbbf0451cf5a962/ltpY6K_PLBv7SfR1D4RZchFHwzII.m4a"} |
| GET | `/v1/episode-video/playback/get` | 1 | data | - |
| GET | `/v1/episode/conversion-components` | 5 | data | - |
| GET | `/v1/episode/get-for-long-press` | 1 | data | - |
| POST | `/v1/episode/list-by-ids` | 1 | data | {"eids":["6af316b6b4a4e20202f7cbd2","6ad1f69e9554aaac00cee13f","6ad9f1ad97726cd467561fa2","6ae27fabe9f449d465057f00","6a |
| POST | `/v1/related-episode/list` | 5 | data | {"eid":"6ad4dacd641ef406308d86e5"} |
| POST | `/v1/vote/get-by-eid` | 6 | - | {"eid":"6ad4dacd641ef406308d86e5"} |

## 播放 / 播放列表（4 个未代理端点）

| 方法 | 路径 | 次数 | 响应顶层 | 请求体样例 |
|---|---|---|---|---|
| GET | `/v1/custom-playlist/config/get` | 4 | data | - |
| GET | `/v1/music-detection/get` | 2 | - | - |
| POST | `/v1/playback-rate-backup/create` | 2 | - | {"defaultPlaybackRate":1.0,"podcastsPlaybackRate":[]} |
| POST | `/v1/playlist/patch` | 5 | data | {"id":"25559373-4e8a-42e3-9c09-f2d5e16524e9","base":"60c7ff9429f4f22a3dd1f7f115ce1193e3910f3466d5e4b98767099ee5d53c4d"," |

## 用户 / 社交（6 个未代理端点）

| 方法 | 路径 | 次数 | 响应顶层 | 请求体样例 |
|---|---|---|---|---|
| GET | `/v1/appreciation/get` | 9 | data | - |
| POST | `/v1/appreciation/get-info-by-uid` | 1 | data | {} |
| GET | `/v1/collection/get` | 3 | data | - |
| POST | `/v1/profile/update` | 1 | data | {"nickname":"SimoneWang"} |
| GET | `/v1/user-config/get` | 25 | teenMode, abtestInfo, showPodcasterSystemNoticeTab, canManageMutedAudiences, con | - |
| GET | `/v1/weekly-letter/get-latest` | 22 | - | - |

## 会员 / 付费（9 个未代理端点）

| 方法 | 路径 | 次数 | 响应顶层 | 请求体样例 |
|---|---|---|---|---|
| GET | `/v1/balance/get` | 3 | data | - |
| GET | `/v1/bean/wallet/get` | 1 | data | - |
| POST | `/v1/coupon/count` | 1 | data | {} |
| POST | `/v1/membership/platform/app-entry` | 22 | data | {} |
| OPTIONS | `/v1/membership/platform/home` | 1 | - | - |
| POST | `/v1/membership/platform/home` | 11 | data | {} |
| OPTIONS | `/v1/payment/list-products` | 1 | - | - |
| POST | `/v1/payment/list-products` | 11 | data | {"productTypes":["PLATFORM_MEMBERSHIP"]} |
| POST | `/v1/transaction/list` | 4 | data | {"type":"ALL","limit":25} |

## 设置 / 其他（7 个未代理端点）

| 方法 | 路径 | 次数 | 响应顶层 | 请求体样例 |
|---|---|---|---|---|
| GET | `/v1/app-config/get` | 3 | allowAnonymous, isWalletVisible, commentEntityRegexps, allowedScheme, allowedHyb | - |
| POST | `/v1/app-theme/list` | 3 | data | {"active":false} |
| POST | `/v1/check/create` | 2 | data | {"eid":"6ad4dacd641ef406308d86e5"} |
| POST | `/v1/sticker/get-library` | 22 | data | {} |
| POST | `/v1/sticker/list-sealed` | 3 | data | {} |
| POST | `/v1/sticker/see-all-new` | 1 | - | {} |
| POST | `/v1/volcengine/provision` | 1 | appId, token, expiresInSeconds, boostingTableId, replacingTableId, boostingWords | {} |

## 其他（4 个）

| 方法 | 路径 | 次数 | 响应顶层 |
|---|---|---|---|
| GET | `/app_auth_tokens.refresh` | 8 | x-jike-access-token, success, x-jike-refresh-token |
| POST | `/v1/pick/create` | 1 | toast |
| POST | `/v1/pick/detect-emotion` | 3 | data |
| POST | `/v1/subscription/list-often-played` | 4 | data |

## xyz 已覆盖、本次也抓到的端点

| 方法 | 路径 | 次数 |
|---|---|---|
| POST | `/v1/category/podcast/list-by-tab` | 20 |
| POST | `/v1/category/podcast/list-tabs` | 6 |
| POST | `/v1/clap/create` | 1 |
| POST | `/v1/clap/list` | 1 |
| POST | `/v1/comment/collect/list` | 4 |
| POST | `/v1/comment/list-primary` | 5 |
| POST | `/v1/editor-pick/list-history` | 1 |
| POST | `/v1/episode-played/create` | 2 |
| POST | `/v1/episode-played/list` | 8 |
| POST | `/v1/episode-played/list-history` | 6 |
| GET | `/v1/episode/get` | 18 |
| POST | `/v1/episode/list` | 1 |
| POST | `/v1/favorite/list` | 2 |
| GET | `/v1/live-stats/episode/get` | 22 |
| POST | `/v1/live-stats/report` | 7 |
| GET | `/v1/mileage/get` | 1 |
| POST | `/v1/mileage/list` | 3 |
| POST | `/v1/mileage/update` | 3 |
| POST | `/v1/pick/list-history` | 1 |
| POST | `/v1/pick/list-recent` | 8 |
| POST | `/v1/pilot-discovery/list` | 1 |
| POST | `/v1/playback-progress/list` | 12 |
| POST | `/v1/playback-progress/update` | 6 |
| GET | `/v1/podcast-bulletin/get-by-pid` | 1 |
| GET | `/v1/podcast/get` | 2 |
| OPTIONS | `/v1/podcast/get` | 1 |
| POST | `/v1/podcaster/owned-podcasts` | 8 |
| GET | `/v1/profile/get` | 15 |
| OPTIONS | `/v1/profile/get` | 1 |
| GET | `/v1/search/get-preset` | 6 |
| POST | `/v1/sticker/get-board` | 12 |
| POST | `/v1/sticker/list` | 9 |
| POST | `/v1/subscription-star/list` | 5 |
| POST | `/v1/subscription-star/update` | 3 |
| POST | `/v1/subscription/list` | 5 |
| POST | `/v1/subscription/list-non-starred` | 1 |
| POST | `/v1/subscription/update` | 2 |
| GET | `/v1/unread-count/get` | 3 |
| POST | `/v1/user-relation/list-follower` | 3 |
| POST | `/v1/user-relation/list-following` | 3 |
| GET | `/v1/user-stats/get` | 10 |
| POST | `/v2/inbox/list` | 2 |

## 建议下一步（按 Web 客户端价值排序）

1. **收件箱对齐 App**：xyz 代理 `/v2/inbox/list`，前端 inbox tab 换 v2（limit/loadMoreKey），并接 `/v1/inbox/remove` 做「已读」。
2. **首页新版 feed**：`/v1/tab/featured/list`、`/v1/tab/discovery/list`、`/v1/tab/category/list` + `/v1/user-config/get` 的 `showDiscoveryFeedV3/enableHomepageTabs` 开关（可做首页 tab 化）。
3. **相关单集推荐**：`/v1/related-episode/list`（我们的单集页目前只有相关播客）。
4. **评论增强（只读）**：`/v1/comment/list-thread/v2`、`/v1/comment/list-timestamp-primary`、`/v1/comment/list-mine`。
5. **播放列表**：`/v1/custom-playlist/config/get`、`/v1/playlist/pull|patch`（注意同步写操作）。
6. **AI 摘要 / 转写（只读展示）**：`/v1/ai-summary/episode/retrieve-brief`、`/v1/episode-transcript/get`。
7. **关注动态 / 周报 / 故事收件箱**：`personal-update/*`、`weekly-letter/get-latest`、`story-inbox/*`。
8. **运营位**：`flash-mob/list`、`flash-screen/list`、`operation-resource/list`、`brand-activity/*`、`new-power-collection/*`。
9. **会员 / 付费 / 赞赏**：`payment/*`、`membership/*`、`balance/get`、`coupon/count`、`appreciation/*`——按你之前的要求，**本轮不碰支付类功能**，只留档。
