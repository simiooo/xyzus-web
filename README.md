# xyz-web — 小宇宙播客 Web 客户端

基于 React 19 + TypeScript 6 + Vite 8 的播客播放器 Web 客户端，使用 Ant Design 6 + Tailwind CSS 3 构建 UI。

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 19、TypeScript 6 |
| 构建 | Vite 8、React Compiler |
| UI | Ant Design 6、Tailwind CSS 3、@ant-design/icons |
| 状态 | Zustand 5 |
| 路由 | React Router 7 |
| API | Alova 3（全部 POST 请求） |
| 服务端 | Nginx |

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

## Docker 部署

项目提供 Docker Compose 一键部署。

```bash
# 构建并启动
docker compose up -d

# 查看日志
docker compose logs -f

# 停止
docker compose down
```

### 架构

```
宿主机 :8080
  └── frontend (Nginx)
        ├── / → 静态文件 (SPA)
        └── /api/* → 反向代理 → backend (Go Gin, 8080)
```

- **frontend**：Nginx 提供前端静态文件，`/api/` 路径反向代理到后端
- **backend**：直接使用镜像 `ultrazg/xyz:v1.4.2`，内部访问不对外暴露

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `VITE_API_BASE_URL` | API 基础地址 | `http://localhost:23020`（开发） / `/api`（生产） |
