# 验证证据（2026-11-10 / 11，本机实测）

> 面向开发者 / 维护者。接口契约见 [API.md](API.md)；功能实现见 [FEATURES.md](FEATURES.md)。
> 本文是历史实测快照（部分补丁条数/字节数为当时记录，当前补丁为 22 条 / 20117 B，见 [FEATURES.md](FEATURES.md)）。

环境：后端 `D:\work\xyz-backend\xyz.exe`（v1.10.3）监听 23020；前端 dev server 5173。

## 1. 后端存活

```text
GET  /ping   → HTTP 200  {"code":200,"message":"pong","version":"1.10.3"}
OPTIONS /discovery → HTTP 204（CORS 预检）
```

## 2. 鉴权行为（纠正调研结论：无 token 是 400 不是 401）

```text
POST /discovery {}                 → HTTP 400  {"code":400,"msg":"错误请求"}
POST /discovery {} + FAKE token    → HTTP 401  {"code":401,"msg":"身份认证信息失效，…"}
```

## 3. 三个硬错误契约（经 dev 代理 /api 与直连后端均复验）

```text
POST /comment_primary {"id":"TEST","order":"HOT"} + FAKE token                        → HTTP 400  {"code":400,"msg":"错误请求"}
POST /comment_primary {"owner":{"id":"TEST","type":"EPISODE"},"order":"HOT"} + FAKE  → HTTP 401  {"code":401,"msg":"身份认证信息失效，…"}
POST /pick_recent {"uid":"TEST"} + FAKE token     → HTTP 404  "404 page not found"
POST /pick_list_recent {"uid":"TEST"} + FAKE      → HTTP 401  {"code":401,…}
POST /top_list {"category":"HOT"} + FAKE          → HTTP 401  {"code":401,…}
POST /private_media_get {"eid":"TEST"} + FAKE     → HTTP 401  {"code":401,…}
POST /private_media_get {} + FAKE                 → HTTP 400  {"code":400,"msg":"错误请求"}
```

## 4. 消息端点（2026-11-11 本机实测，为 /inbox 页面新增）

```text
POST /inbox_list {} + 无 token                                  → HTTP 400  {"code":400,"msg":"错误请求"}
POST /inbox_list {} + FAKE token                                → HTTP 401  {"code":401,"msg":"身份认证信息失效，…"}
POST /inbox_list {"loadMoreKey":{"pubDate":…,"id":…}} + FAKE     → HTTP 401  （body 绑定通过，游标结构正确）
POST /unread_count {} + 无 token                                → HTTP 400  {"code":400,"msg":"错误请求"}
POST /unread_count（无 body）+ FAKE token                        → HTTP 401  {"code":401,…}
```

## 5. 通知补丁端点（2026-11-11，backend-notify 实测；xyz 补丁见 `backend-patches/`）

```text
POST /notice_list {} + 无 token                                  → HTTP 400  {"code":400,"msg":"错误请求"}
POST /notice_list {} + FAKE token                                → HTTP 401  （上游日志 /v1/notice/list 401）
POST /notice_list 非法 JSON + FAKE token                          → HTTP 400  （body 绑定错误可见）
POST /inbox_remove {"eids":[…]} + FAKE token                      → HTTP 401  （上游 /v1/inbox/remove）
POST /system_notice_list {} + FAKE token                          → HTTP 401  （上游 /api/systemNotice/systemNotice/list）
POST /system_notice_unread {} + FAKE token                        → HTTP 401  （上游 /api/systemNotice/unread/get）
```

## 6. 首页 / 收件箱 v2 / 相关单集补丁端点（2026-11-11，backend-homefeed 实测；xyz 补丁共 21 条路由）

```text
POST /inbox_list_v2 {"limit":20} + 无 token           → HTTP 400；+ FAKE token → HTTP 401（上游 /v2/inbox/list）
POST /tab_featured_list {"returnAll":true,…} + FAKE   → HTTP 401（上游 /v1/tab/featured/list）
POST /tab_discovery_list {"returnAll":true,…} + FAKE  → HTTP 401（上游 /v1/tab/discovery/list）
POST /tab_category_list {} + FAKE                     → HTTP 401（上游 /v1/tab/category/list）
POST /related_episode_list {"eid":"…"} + FAKE         → HTTP 401（上游 /v1/related-episode/list）
```

## 7. 评论增强补丁端点（2026-11-11，真实 token + App 设备头实测；上游全部 200）

```text
POST /comment_list_thread_v2 {"primaryCommentId":…,"order":"SMART"}  → HTTP 200（上游 /v1/comment/list-thread/v2）
POST /comment_list_mine {"order":"TIME","limit":20}                  → HTTP 200（上游 /v1/comment/list-mine，返回 3 条带 episode）
POST /comment_list_timestamp_primary {"owner":{…},"from","to"}       → HTTP 200（上游 /v1/comment/list-timestamp-primary，返回时点标记）
POST /comment_get {"commentId":"…"}                                  → HTTP 200（上游 GET /v1/comment/get?commentId=，标记 → 评论正文）
```

## 8. AI 摘要 / 文字稿（2026-11-11，真实 token + App 设备头实测）

```text
POST /ai_summary_episode_retrieve_brief {"eid":"…"}    → HTTP 200（summary.status=ready，brief 93 字）
POST /episode_transcript_get {"eid","mediaId"}         → HTTP 200（transcriptUrl / highlightUrl）
POST /episode_transcript_content {"url":<transcriptUrl>} → HTTP 200（787 段 [{text,startMs}]，后端代取 CDN）
```

## 9. 关注动态 / 常听节目（2026-11-11，真实 token + App 设备头实测）

```text
POST /following_updates_list {}        → HTTP 200（上游 /v1/personal-update/list-following-updates；1 条动态，showSticker=false）
POST /subscription_often_played {"limit":25} → HTTP 200（上游 /v1/subscription/list-often-played；3 个节目）
```

## 10. 星标订阅（xyz 内置路由，2026-11-11 真实 token 实测；测试账号已还原）

```text
POST /subscription_star {}                              → HTTP 200（1 个星标节目）
POST /subscription_star_update {"pid":…,"withStar":true}  → HTTP 200（星标数 1→2）
POST /subscription_star_update {"pid":…,"withStar":false} → HTTP 200（恢复 1，未留改动）
```

## 11. 播放状态同步 / 续听（2026-11-11，真实 token 实测；测试账号已还原）

```text
POST /episode_played_history_list {}              → HTTP 200（最近收听 20 条，首条即上次播放的单集）
POST /playback_progress_list {"eids":[eid]}       → HTTP 200（{progress:2169, playedAt:…}）
POST /playback_progress_update {data:[{…progress:2229}]} → HTTP 200；随后 list 读到 2229
POST /playback_progress_update {旧 playedAt}      → HTTP 200 但**不生效**（服务端按 playedAt 最后写入优先）
POST /episode_played_create {"eid"}               → HTTP 200
```

> 坑：上游用请求头 `local-time` 校验/排序进度写入，固定旧值或格式不符会「200 但静默丢弃」；
> `utils/http.go` 已对每个上游请求无条件动态生成 `local-time`（对齐 App 格式），已纳入生产补丁（见 [FEATURES.md](FEATURES.md)）。

## 12. dev 代理 / 页面路由（本次一并修复）

```text
GET  http://localhost:5173/login   (Accept: text/html) → <!doctype html><html lang="zh-CN">…（不再 404 page not found）
GET  http://localhost:5173/profile (Accept: text/html) → <!doctype html>…（前端路由不被代理）
POST http://localhost:5173/api/profile + FAKE token    → HTTP 401 {"code":401,…}（/api 正确代理到 23020）
```

## 13. 扫码登录代理（本机实测，2026-11-11）

```text
POST http://localhost:5173/qrcode-api/create {"clientId":"xyz-web"}
  → 200 {"id":"6af4025e6c1b8642d31cf890","url":"https://h5.xiaoyuzhoufm.com/oauth?qrcode_id=6af4025e6c1b8642d31cf890"}
POST http://localhost:5173/qrcode-api/login {"id":"6af4025e6c1b8642d31cf890"}
  → 200 {"status":"WAITTING"}        （上游等待扫码；确认后 token 在响应头）
```

上游直连（对照）：`POST https://web-api.xiaoyuzhoufm.com/v1/auth/qrcode/create` 带
`x-midway-app-id: v6worU4NnWyL` → 同上；不带该头 → `400 {"code":1,"message":"invalid x-midway-app-id"}`。
CORS：`Origin` 只回显官方域与 `http://localhost:*`，所以必须同源代理（见 [FEATURES.md](FEATURES.md) 登录）。

## 14. 全端点扫描

31 个端点用「假 token + 合法 body」逐一 POST → 全部 HTTP 401（`B`），证明路由与 body 绑定均正确；
`/sendCode`、`/login` 用非法手机号 → HTTP 404（上游拒绝）。

## 15. 构建 / 检查

```text
pnpm build   → ✅ 通过（tsc -b + vite build；仅剩 antd 主包 >500kB 的 chunk 体积提示）
pnpm lint    → ✅ 0 error（eslint . 全仓通过）
docker build --check -f Dockerfile/backend.Dockerfile → ✅ no warnings
docker compose config → ✅ 通过
nginx -t（容器内，/api 反代）→ ✅ syntax is ok / test is successful
```

> 2026-11-11 消息中心（收件箱 + 通知双 tab）与 xyz 通知补丁：`pnpm build`、`pnpm lint` 均通过
> （通知页截图见 `shots/inbox-notify/`，收件箱截图见 `shots/inbox-check/`）；
> `backend-patches/notification-endpoints.patch`（21 条代理路由）在干净 worktree 上正向 `git apply` + `go build` 验证通过，
> 且 apply 后文件与工作区一致；补丁 16393 B。

## 16. 未验证项（如实说明）

- 所有返回 HTTP 200 的**真实数据形状**未验证：本机没有可用的真实小宇宙账号 token，只有 401 路径可测；
  形状依据 xyz v1.10.3 源码 + `D:\work\xyz-backend\doc\docs\*.md`。
- `/sendCode`、`/login` 成功路径无法验证：上游已关闭（404），保留只为将来恢复。
- **扫码登录的「扫码 → 手机确认 → 拿 token」这一步未端到端验证**：建码与轮询（`WAITTING`）已实测通过，
  确认后的 token 取自上游响应头，需要真人用手机扫码才能跑完；这是当前唯一待验证的登录环节。
- `/refresh_token` 成功路径未验证（无有效 token）。
- `/private_media_get` 成功路径未验证（需要已购买该单集的账号）。
- `/inbox_list`、`/unread_count` 的 **HTTP 200 真实数据形状未验证**（无真实 token）：形状依据 xyz handler
  与 `doc/docs/inboxList.md`、`unreadCount.md`；`A/B` 路由与 body 绑定已实测（见上）。
- Docker 镜像的完整 `docker compose up --build` 未跑（本机已完成前端 `pnpm build`、Dockerfile 静态检查、compose config、nginx -t；后端镜像需联网 clone 上游仓库）。