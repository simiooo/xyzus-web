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
- **后端镜像（默认拉取，不本地构建）**：`docker-compose.yml` 的 backend 用 `image: ghcr.io/simiooo/xyzus-backend:<tag>`，
  直接拉取公有预构建镜像（多架构 amd64/arm64）。镜像由后端仓库 [simiooo/xyzus-backend](https://github.com/simiooo/xyzus-backend)
  的 GitHub Actions（`.github/workflows/docker.yml`）构建并发布到 GHCR，tags `latest` / `sha-<commit>` / `v*`。
  部署机无需装 Go / clone 上游；compose 钉住 `sha-<commit>` 保证可复现。
- `nginx.conf`：`location /api/ { proxy_pass http://backend:23020/; }`（剥离 `/api`），其余交 SPA。
- `docker-compose.yml`：`frontend:8080 → 80`（本地构建），`backend` 拉取镜像、只 `expose 23020`，`TZ=Asia/Shanghai`。

```bash
docker compose config          # 校验配置
docker compose up -d --build   # 构建前端 + 拉取后端镜像并启动
docker compose ps / logs -f    # 查看状态/日志
docker compose down            # 停止
```

**后端源码与补丁**：后端 = 上游 xyz `22cfe78` + 22 条代理端点 + local-time 修复，已作为公有仓库
[simiooo/xyzus-backend](https://github.com/simiooo/xyzus-backend) 维护（补丁即其 git 历史）。
升级后端：在该仓库提交 → CI 自动出新镜像 → 把 compose 的 tag bump 到新 `sha-<commit>`（或 `latest`）。

**离线 / 本地构建 fallback**：无 registry 访问时，可用本仓库 `backend.Dockerfile`（克隆上游 `22cfe78` +
apply `backend-patches/notification-endpoints.patch`，`GOPROXY=goproxy.cn`）自行构建后端镜像，
再把 compose 的 backend 改回 `build:`。国内网络下该 fallback 需能访问 GitHub（见 [AGENT-DEPLOY.md](AGENT-DEPLOY.md)）。

> 后端 `utils/http.go` 每请求动态生成 `local-time`（对齐 App 格式），保证播放进度跨端同步不被上游静默丢弃，
> 详见 [FEATURES.md](FEATURES.md) 的「最近收听增量同步 + 补丁修复」一节。