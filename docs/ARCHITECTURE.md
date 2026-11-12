# 架构与部署内部

> 面向开发者 / 维护者。用户安装与使用见 [README](../README.md)；从干净机器部署的完整 runbook 见 [AGENT-DEPLOY.md](AGENT-DEPLOY.md)。

## 1. 请求链路

```
浏览器
  ├─ /api/*       ──(dev: Vite proxy / prod: nginx)──> xyz 后端 :23020 ──> api.xiaoyuzhoufm.com
  │                                                    （补 iOS 头 + 转发 Token）
  ├─ /qrcode-api/* ──(dev: Vite proxy / prod: nginx)──> web-api.xiaoyuzhoufm.com/v1/auth/qrcode/*
  │                                                    （扫码登录：代理补 x-midway-app-id，透传 token 响应头）
  └─ Alova（统一 POST，信封 {code,msg,data}，401 自动 refresh→重试）
```

- **dev 代理**：`vite.config.ts` 只有一条 `/api` 前缀规则（`/api/discovery → localhost:23020/discovery`）。
  不再逐个枚举端点，新增端点自动覆盖；`/login`、`/profile` 等**前端页面路由**不在 `/api` 下，因此不会被后端 404 吃掉。
- **生产**：`nginx.conf` 的 `location /api/` 与 dev 规则完全一致（`/api` 前缀被剥离后转发）；
  扫码登录另有 `location /qrcode-api/`（见 [FEATURES.md](FEATURES.md) 的「登录」一节）。
- **API 层归一化**：后端会把上游 JSON **原样**塞进 `data`（所以常见 `data.data.items`），
  `src/api/normalize.ts` 的 `unwrapData / unwrapList / unwrapPage / unwrapItem / pluckList`
  在 api 层把包裹层吃掉，**页面只拿干净数组/对象**与统一分页形状 `{ items, loadMoreKey? }`。
- **Token**：`localStorage` 的 `x-jike-access-token` / `x-jike-refresh-token`；`beforeRequest` 注入
  `x-jike-access-token`；HTTP 401 → `POST /refresh_token`（body 带两个 token）→ 重试；失败清空并广播 `auth:expired`。

接口契约与端点总表见 [API.md](API.md)。

## 2. 直连上游模式（文档备选，本期未实现）

实测上游 `api.xiaoyuzhoufm.com` 的 CORS 是放开的（`OPTIONS` 204 + `Access-Control-Allow-Origin` 回显），
理论上浏览器可直连。但 xyz 存在的意义是补齐 iOS 专用请求头（`User-Agent`/`App-Version`/`Market`/`Local-Time` 等），
浏览器 `fetch` **无法设置 User-Agent 等头**，直连容易被风控识别，且无法使用 `/private_media_get` 等带签名的能力。
**本期固定用 xyz 代理**；直连只在本文档留档，不提供实现。

## 3. 部署（Docker）内部

```
浏览器 → http://localhost:8080
           └── frontend (nginx)
                 ├── / → 静态文件（SPA fallback index.html）
                 └── /api/* → 反代 → backend:23020 (xyz，不对外暴露)
                       └── 上游 api.xiaoyuzhoufm.com
```

- `Dockerfile`：Node 24 + pnpm 10 构建 `dist`，nginx 托管；`.env.production` 的 `VITE_API_BASE_URL=/api`。
- `backend.Dockerfile`：**钉住** xyz commit `22cfe78`（v1.10.3 实测版本），`GOPROXY=https://goproxy.cn,direct`，默认监听 23020。
- `nginx.conf`：`location /api/ { proxy_pass http://backend:23020/; }`（剥离 `/api`），其余交 SPA。
- `docker-compose.yml`：`frontend:8080 → 80`，`backend` 只 `expose 23020`，后端 `TZ=Asia/Shanghai`。

```bash
docker compose config          # 校验配置
docker compose up -d --build   # 构建并启动
docker compose ps / logs -f    # 查看状态/日志
docker compose down            # 停止
```

**注意**：`backend.Dockerfile` 构建时会 clone 上游仓库（需能访问 GitHub）；国内网络下已配置 GOPROXY 镜像。
clone 之后会应用 `backend-patches/notification-endpoints.patch`（22 条代理端点 + local-time 修复，见 [FEATURES.md](FEATURES.md)），
所以新增后端端点不需要 fork 上游，改补丁文件即可。

> 后端 `utils/http.go` 每请求动态生成 `local-time`（对齐 App 格式），保证播放进度跨端同步不被上游静默丢弃，
> 详见 [FEATURES.md](FEATURES.md) 的「最近收听增量同步 + 补丁修复」一节。