# 自建 xyz 后端（https://github.com/ultrazg/xyz）
#
# 本项目的接口层契约是按 xyz v1.10.3 / commit 22cfe78 实测校准的，
# 所以这里钉住 commit，避免上游 `dev` 分支变动导致契约漂移。
#
# 构建：docker build -f backend.Dockerfile -t xyz-backend .
# 运行：docker run --rm -p 23020:23020 xyz-backend
FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git ca-certificates

# 上游仓库与要构建的 commit（如需升级后端，改这里并重新跑接口联调）
ARG XYZ_REPO=https://github.com/ultrazg/xyz.git
ARG XYZ_REF=22cfe78

ENV GOPROXY=https://goproxy.cn,direct
ENV CGO_ENABLED=0

WORKDIR /src
RUN git clone "${XYZ_REPO}" . \
 && git checkout "${XYZ_REF}"

# 本地补丁：通知 / 首页 tab / 相关单集 / 收件箱 v2 / 评论增强 / AI / 关注动态 / 播放同步等 21 条代理端点。
# 补丁由 backend-patches/notification-endpoints.patch 维护，钉住上游 commit 后再 apply，
# 这样既能复现构建，又不用 fork 仓库。
COPY backend-patches/ /tmp/backend-patches/
RUN git apply --verbose /tmp/backend-patches/notification-endpoints.patch \
 && go mod tidy \
 && go build -ldflags="-s -w" -o /xyz .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /xyz /usr/local/bin/xyz

# xyz 默认监听 23020；需要换端口时用 `CMD ["xyz", "-p", "3000"]`
EXPOSE 23020

CMD ["xyz"]
