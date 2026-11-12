# 故障排查

> 接口 / 运行时问题见下表；**部署 / Docker / WSL2 / 国内镜像**相关问题见 [AGENT-DEPLOY.md](AGENT-DEPLOY.md) 的「常见坑（Agent 自查表）」。
> 接口契约见 [API.md](API.md)，登录与功能细节见 [FEATURES.md](FEATURES.md)。

| 现象 | 原因 / 处理 |
|---|---|
| 页面报「网络异常：请求没有送达后端」 | xyz 后端没起 / 端口不对；`curl http://localhost:23020/ping` 确认 |
| 接口返回 400「错误请求」 | 请求体与契约不符（对照 [API.md](API.md) 端点总表）或**完全没带 token**（xyz 中间件如此，见 [API.md](API.md) 响应信封） |
| 接口 401 且不停跳登录 | access token 过期且 refresh token 不配对；重新登录或用「粘贴 token」重贴成对 token |
| `/sendCode` 返回 404 或 `code:1003` | 上游短信登录通道已关闭（见 [FEATURES.md](FEATURES.md) 登录）；改用「扫码登录」或「Token 登录」 |
| dev 页面打不开被 404 | 确认访问的是 `http://localhost:5173/`；dev 代理只代理 `/api/*`，页面路由不会被后端吃 |
| dev server 被 `EBUSY: resource busy or locked, watch …tmpdir` 杀掉 | 已由 `vite.config.ts` 的 `server.watch.ignored`（`**/*.tmpdir/**`、`**/*.tmp`、`shots/` 等）修复；如仍出现请补充忽略规则 |
| 付费单集点播放没声音 | 见 [FEATURES.md](FEATURES.md) 付费/私密单集：需在小宇宙 App 购买；`resolveEpisodeAudioUrl` 会返回 `reason` 供 UI 提示 |
| 消息页「通知」显示「通知加载失败，请稍后重试」 | 本机 `xyz.exe` 还是旧版（没有 `/notice_list`）。用 `backend.Dockerfile` 或「干净 clone + `git apply backend-patches/notification-endpoints.patch` + `go build`」重启后端 |
| 首页 tab / 相关单集 / 收件箱 v2 / 评论增强 / AI / 关注动态 / 播放同步 / 最近收听增量同步接口 404 | 同上：后端没打 22 条补丁。重新构建并重启后端；`/tab_*`、`/related_episode_list`、`/inbox_list_v2`、`/comment_list_*`、`/ai_summary_*`、`/episode_transcript_*`、`/following_updates_list`、`/subscription_often_played`、`/playback_progress_*`、`/episode_played_create`、`/episode_played_list_for_cache` 由补丁提供 |