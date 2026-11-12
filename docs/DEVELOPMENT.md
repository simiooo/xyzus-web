# 本地开发（真机联调 / 离线 mock / 环境变量）

> 面向开发者。普通用户用 Docker 一键部署即可，见 [README](../README.md)；工程约定见 [AGENTS.md](../AGENTS.md)。

## 1. 只看界面（离线 mock，不需要后端 / 数据库）

```bash
pnpm install
VITE_API_MOCK=1 pnpm dev        # 离线 mock 数据（src/mock/），打开 http://localhost:5173/
```

> mock 覆盖 discovery / top_list / podcast_detail / episode_list / comment_primary / comment_list_thread_v2 / comment_list_mine / comment_list_timestamp_primary / comment_get / ai_summary_episode_retrieve_brief / episode_transcript_get / episode_transcript_content / search / category / subscription / inbox_list / inbox_list_v2 / notice_list / tab_featured_list / tab_discovery_list / tab_category_list / related_episode_list / unread_count / favorites / profile / pick / login… 全端点；
> 也可以 `?mock=1`（会持久化到 localStorage）临时切换，`?mock=0` 显式切回真后端。

截图验收（无头 Chrome，脚本自带最小 CDP 客户端，不依赖 puppeteer）：

```bash
node scripts/shot.mjs --url http://localhost:5173/ --out shots/home.png --width 1440 --height 900
node scripts/shoot-all.mjs      # 批量：桌面 + 移动，输出到 shots/
```

## 2. 真机联调（需要自建 xyz 后端）

```bash
# 1) 起后端：克隆补丁版后端（含 22 条代理端点 + local-time 修复；上游 ultrazg/xyz 缺这些路由）到任意目录
git clone https://github.com/simiooo/xyzus-backend ../xyz-backend
cd ../xyz-backend
go build -o xyz .                # 国内可用 $env:GOPROXY='https://goproxy.cn,direct'（PowerShell）
./xyz                            # 默认监听 23020；xyz -p 3000 可改端口（此时同步改 XYZ_API_TARGET）

# 2) 起前端（回到本仓库）
cd -
pnpm dev                         # http://localhost:5173/，/api/* 由 Vite 代理到 localhost:23020
```

后端也可用 Docker 单独跑，见 [xyzus-backend](https://github.com/simiooo/xyzus-backend) 与 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 3. 环境变量

| 变量 | 作用 | 默认 |
|---|---|---|
| `VITE_API_BASE_URL` | API 基础地址。`/api` 走 dev 代理或 nginx；也可写 `http://localhost:23020` 直连后端 | `.env`/`.env.development`/`.env.production` 均为 `/api` |
| `VITE_API_MOCK` | `1` 时走离线 mock，不发网络请求 | 未设置 |
| `XYZ_API_TARGET` | 仅 dev：Vite 代理目标 | `http://localhost:23020` |

> 想绕过代理直连本机后端：`VITE_API_BASE_URL=http://localhost:23020 pnpm dev`（xyz 的 CORS 已放开）。

## 4. 常用命令

```sh
pnpm dev        # Vite dev server（/api 等端点代理到 xyz 后端 http://localhost:23020）
pnpm build      # tsc -b && vite build（先类型检查）
pnpm lint       # ESLint flat config
pnpm preview    # vite preview
```

> 包管理器一律用 **pnpm**；路径别名 `@/` → `src/`；组件 default export、工具函数具名导出。更多见 [AGENTS.md](../AGENTS.md)。