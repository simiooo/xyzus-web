# 前端静态站点：pnpm build → nginx
#
# 生产镜像里 `/api/*` 由 nginx 反代到 backend:23020（见 nginx.conf），
# 与 dev 环境 Vite 的 `/api` 代理规则一致（见 vite.config.ts）。
FROM node:24-alpine AS builder

ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable pnpm && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm config set registry https://registry.npmmirror.com
RUN pnpm install --frozen-lockfile

COPY . .
# .env.production 里 VITE_API_BASE_URL=/api，与 nginx 的 /api 反代对应
RUN pnpm build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
