# xyz-web — 小宇宙播客 Web 客户端

基于 React 19 + TypeScript 6 + Vite 8 的播客播放器 Web 客户端，使用 Ant Design 6 + Tailwind CSS 3 构建 UI。

## 快速部署（推荐小白使用）

只需安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)，然后一键启动：

```bash
git clone https://github.com/你的用户名/xyz-web.git
cd xyz-web
docker compose up -d
```

启动完成后，浏览器访问 **http://localhost:8080/** 即可使用。

> 首次构建需要下载依赖，可能需要几分钟，请耐心等待。

常用命令：

```bash
# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（API 代理到 localhost:23020）
pnpm dev

# 代码检查
pnpm lint

# 构建
pnpm build
```

开发服务器需配合后端服务运行，后端地址配置在 `.env` 的 `VITE_API_BASE_URL`。

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 19、TypeScript 6 |
| 构建 | Vite 8、React Compiler |
| UI | Ant Design 6、Tailwind CSS 3、@ant-design/icons |
| 状态 | Zustand 5 |
| 路由 | React Router 7 |
| API | Alova 3（全部 POST 请求） |

## Docker 架构

```
浏览器 → http://localhost:8080
           └── frontend (Nginx)
                 ├── / → 静态文件 (SPA)
                 └── /api/* → 反向代理 → backend:23020 (Go)
```

- **frontend**：Nginx 提供前端静态文件，`/api/` 路径反向代理到后端
- **backend**：从源码构建 Go 二进制，监听 23020 端口，不对外暴露

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `VITE_API_BASE_URL` | API 基础地址 | `http://localhost:23020`（开发） / `/api`（生产） |