# 给 Agent 的部署指南（按环境分支）

> 这是一份**给 AI Agent / 自动化脚本**在「一台干净机器」上把本项目跑起来的 runbook，也适合人工照着做。
> 普通用户的精简安装/使用见 [README](../README.md)；接口与功能细节见 [FEATURES.md](FEATURES.md)、[API.md](API.md)；部署内部见 [ARCHITECTURE.md](ARCHITECTURE.md)。
>
> 目标产物：`docker compose up -d --build` 起前端 + 补丁后端，浏览器打开 `http://localhost:8080/`（局域网 `http://<主机IP>:8080/`）扫码登录即用。
> **核心原则**：每一步先「检查」再「安装」，已具备就跳过；所有命令尽量幂等；**国内 / 国外走不同分支**（镜像加速、下载源）。
> 涉及第三方镜像地址会随时间失效，文中对**易变地址**标注「需实测」，执行前先验证可达，不要盲信。

## 1. 决策总览

```
探测环境（OS / 架构 / 国内 or 国外）
  → 检查并安装 Git
  → 检查并安装 Docker + Compose v2
       ├─ Windows：先装 WSL2（需 BIOS 虚拟化），再装 Docker Desktop
       ├─ macOS：Docker Desktop（或 OrbStack / colima）
       └─ Linux：Docker Engine（get.docker.com）
  → 【仅国内】配置镜像加速（registry-mirrors；GOPROXY / npm 已内置无需改）
  → git clone 本仓库 → docker compose up -d --build
  → 验证（容器状态 / 本机 8080 / 局域网 / 扫码登录）
```

## 2. 第一步：探测环境（OS / 架构 / 国内 or 国外）

**OS 与架构**（决定用哪套安装命令）：

```bash
uname -s        # Linux / Darwin（macOS）/ MINGW*|MSYS*（Windows 的 Git Bash）
uname -m        # x86_64 / aarch64|arm64（Apple Silicon 是 arm64）
```

- Windows 也可在 PowerShell 用 `$env:OS`（`Windows_NT`）、`[Environment]::Is64BitOperatingSystem`；
  家庭版 / 专业版影响 WSL2 与 Hyper-V 的可用性（WSL2 家庭版也可用）。

**国内还是国外**（决定要不要配镜像加速）——时区 / 语言只是线索，**以网络探测为准**：

```bash
# 线索：东八区 + 中文 locale 多半是国内（但不绝对）
date +%z                      # +0800 → 东八区线索
# 判定：google 不通而 baidu 通 → 大概率国内；两者都通 → 国外或已有代理
curl -m 5 -s -o /dev/null -w "google=%{http_code}\n" https://www.google.com   # 国外可达≈200，国内常≈000
curl -m 5 -s -o /dev/null -w "baidu=%{http_code}\n"  https://www.baidu.com    # 国内可达≈200
# 关键源可达性（构建会用到）：Docker Hub 与 GitHub
curl -m 5 -s -o /dev/null -w "dockerhub=%{http_code}\n" https://registry-1.docker.io/v2/
curl -m 5 -s -o /dev/null -w "github=%{http_code}\n"    https://github.com
```

> Windows PowerShell 里 `curl` 是 `Invoke-WebRequest` 的别名，请用 `curl.exe`（或在 Git Bash 里跑上面的命令）。
> **判定规则**：`google≈000` 且 `baidu≈200` → 走**国内分支**；`google≈200` → 走**国外分支**；
> 若已配全局代理则可能两者都通，按国外分支即可。**探测不确定时，直接问用户「这台机器在国内还是国外网络」**，不要猜。

## 3. 第二步：检查并安装 Git

```bash
git --version    # 有输出（≥2.x）即跳过安装
```

未安装时按 OS 装（国内优先用镜像）：

| OS | 国外 | 国内加速 |
|---|---|---|
| Windows | `winget install --id Git.Git`（或 [git-scm.com](https://git-scm.com/download/win)） | 华为云镜像 `https://mirrors.huaweicloud.com/git-for-windows/`、npmmirror `https://registry.npmmirror.com/-/binary/git-for-windows/`（需实测） |
| macOS | `xcode-select --install`（含 git）或 `brew install git` | Homebrew 国内镜像（清华 / 中科大 brew.git，需实测） |
| Linux | `sudo apt-get install -y git` / `sudo dnf install -y git` | 发行版已配国内源则无需额外操作 |

## 4. 第三步：检查并安装 Docker + Compose v2

```bash
docker --version          # Docker ≥ 20.10（Compose v2 已内置）
docker compose version    # 有 v2 输出即可，无需单独装 docker-compose
docker info               # 能连上引擎（Server 段有输出）才算就绪
```

三者都正常 → 跳到第 5 节（国内）或第 6 节（国外）。否则按 OS 安装：

### Windows（先 WSL2，后 Docker Desktop）

1. **检查 / 安装 WSL2**（Docker Desktop 推荐后端，比 Hyper-V 省资源、兼容更好）。管理员 PowerShell：
   ```powershell
   wsl --status                 # 看默认版本是否 2；wsl -l -v 看已装发行版
   wsl --install                # 未装时一键安装（含「虚拟机平台」组件），完成后重启
   wsl --set-default-version 2  # 强制 WSL2
   wsl --update                 # 已装但内核太旧时升级
   ```
   - 报 `virtualisation support was not detected` / WSL 安装失败：进 **BIOS 开启 CPU 虚拟化**
     （Intel `VT-x`，AMD `SVM Mode`），保存重启；并在「启用或关闭 Windows 功能」勾选
     **适用于 Linux 的 Windows 子系统** 与 **虚拟机平台**。
2. **安装 Docker Desktop**：从官网 [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) 下载安装包
   （**优先官方包，避免第三方渠道**）。安装时勾选 *Install required Windows components for WSL2*；
   首次启动在 Settings → General 勾选 *Use the WSL 2 based engine*，并在 Resources → WSL Integration 启用对应发行版。
   - **国内下载慢**：官网安装包走境外 CDN，可能很慢或断流；可用用户已有的下载代理，或国内软件下载站的 Docker Desktop 镜像（**需实测版本与完整性**，装完核对版本号）。
3. 验证：`docker run --rm hello-world`。

### macOS

- 安装 Docker Desktop（[官网](https://www.docker.com/products/docker-desktop/)，**区分 Intel 与 Apple Silicon 两个安装包，不能混用**）；
  轻量替代：`brew install orbstack`（OrbStack）或 `brew install colima docker && colima start`。
- 国内下载慢同样可用代理 / 镜像（需实测）。验证：`docker run --rm hello-world`。

### Linux（Docker Engine）

```bash
# 国外：官方一键脚本
curl -fsSL https://get.docker.com | sh
# 国内：用阿里云镜像加速安装（脚本内置 --mirror）
curl -fsSL https://get.docker.com | sh -s docker --mirror Aliyun

# 免 sudo（可选）：加入 docker 组后重新登录或 newgrp docker
sudo usermod -aG docker "$USER" && newgrp docker
# 开机自启 + 立即启动
sudo systemctl enable --now docker
# 验证
docker run --rm hello-world && docker compose version
```

> 也可用发行版仓库 + 国内 docker-ce 镜像（阿里云 `https://mirrors.aliyun.com/docker-ce/`、清华 `https://mirrors.tuna.tsinghua.edu.cn/docker-ce/`）手动装 `docker-ce docker-ce-cli containerd.io docker-compose-plugin`。

## 5. 第四步（仅国内）：配置镜像加速

> 国外分支跳过本节，直接第 6 节。默认部署下**后端是公有预构建镜像**（`ghcr.io/simiooo/xyzus-backend`，直接拉取、不本地编译），
> 前端在本地构建（npm 源已内置 `registry.npmmirror.com`）。所以这里要解决两件事：
> **A. 拉取前端基础镜像**（`node:24-alpine` / `nginx:alpine`，来自 Docker Hub）；**B. 拉取后端镜像**（来自 ghcr.io）。
> 仅当改用离线 fallback `backend.Dockerfile` 本地构建后端时，才需要 GOPROXY=goproxy.cn 与 clone GitHub（见 B 末尾）。

### A. Docker Hub 镜像加速（registry-mirrors）

- **Linux / WSL2 内直装 docker-ce**：写 `/etc/docker/daemon.json` 后重启引擎：
  ```bash
  sudo mkdir -p /etc/docker
  sudo tee /etc/docker/daemon.json <<'EOF'
  {
    "registry-mirrors": ["https://docker.m.daocloud.io"]
  }
  EOF
  sudo systemctl daemon-reload && sudo systemctl restart docker
  ```
- **Windows / macOS 的 Docker Desktop**：Settings → **Docker Engine**，在 JSON 里**追加**（不要覆盖原有字段）：
  ```json
  { "registry-mirrors": ["https://docker.m.daocloud.io"] }
  ```
  点 **Apply & Restart**。

地址选择（**易变，执行前先实测可达**）：
- 相对老牌稳定：`https://docker.m.daocloud.io`（DaoCloud 公共源，小镜像基本秒拉）。
- 其它公共源（`docker.1ms.run`、`docker.1panel.live`、`dockerproxy.net`、`mirror.baidubce.com`、轩辕 `docker.xuanyuan.me` 等）**时效性参差，需逐个实测**，可配多个做兜底。
- **已失效，若在配置里请删除**：网易 `hub-mirror.c.163.com`（公共加速已停用）。
- **只在对应云内网生效，家里 / 普通机器无效**：阿里云个人专属 `https://<你的ID>.mirror.aliyuncs.com`（仅阿里云 ECS）、腾讯 `mirror.ccs.tencentyun.com`（仅腾讯云内网）。

**验证加速真的生效**（只看 `docker info` 不够）：
```bash
docker info | grep -A3 "Registry Mirrors"   # 列出你配的地址＝引擎已启用
docker pull alpine:latest                    # 拉取层地址应指向镜像源域名，而非 registry-1.docker.io
```

### B. 拉取后端镜像（ghcr.io）

后端镜像在 `ghcr.io/simiooo/xyzus-backend`（公有、匿名可拉、多架构 amd64/arm64）。
1. **先直接试**：`docker pull ghcr.io/simiooo/xyzus-backend:latest`。很多国内网络能直连 ghcr.io（本项目构建机实测可达）。
2. **拉取失败时用代理**：给 Docker 引擎配 HTTP 代理（Docker Desktop → Settings → Resources → Proxies），或走用户已有的梯子。
3. **关于 ghcr 镜像站**：DaoCloud 的 `ghcr.m.daocloud.io` **只代理白名单内的热门镜像**，本镜像不在白名单（实测返回 "not in the allowlist"），**不要用它**；其它 ghcr 镜像站同理需先实测。
4. **离线 fallback（不依赖 ghcr）**：把 compose 的 backend 改回 `build:`（用本仓库 `backend.Dockerfile`，克隆上游 `22cfe78` + apply 补丁，GOPROXY 已内置 goproxy.cn）。此时需能访问 GitHub：先直接试 clone，失败用代理，或覆盖 `XYZ_REPO` 为**实测可用的 GitHub 镜像**（`backend.Dockerfile` 暴露了 `ARG XYZ_REPO`/`XYZ_REF`）：
   ```yaml
   backend:
     build:
       context: .
       dockerfile: backend.Dockerfile
       args:
         XYZ_REPO: https://<实测可用的GitHub镜像>/ultrazg/xyz.git
   ```
   > GitHub 镜像（ghproxy / gitclone / kkgithub 之类）**极易失效，务必先 `git ls-remote` 实测**再用；镜像只是加速 clone，commit `22cfe78` 与补丁不变。

### C. WSL2 的 DNS 坑

配好镜像源后 `docker pull` 仍超时、但 `docker info` 显示已生效，多半是 WSL2 DNS 解析失败。
`nslookup docker.m.daocloud.io` 验证；必要时在 `/etc/wsl.conf` 设 `generateResolvConf=false` 并手动写公共 DNS，再 `wsl --shutdown` 重启。

## 6. 第五步：克隆仓库 + 一键起

```bash
git clone https://github.com/simiooo/xyzus-web.git   # 国内慢/失败时用代理或 GitHub 镜像（需实测）
cd xyzus-web
docker compose up -d --build
```

- 一条命令**构建前端**（`pnpm build` → nginx，npm 源已内置 npmmirror）并**拉取后端公有镜像**
  （`ghcr.io/simiooo/xyzus-backend`，含 22 条代理端点 + local-time 修复，多架构；后端不在本地编译）。
- 前端 `8080:80`，后端只 `expose 23020`（不对外），后端 `TZ=Asia/Shanghai`。
- **不需要**手动起后端、不需要装 Go（后端是现成镜像）；前端构建在镜像里完成，本机也不用装 Node/pnpm。

## 7. 第六步：验证

```bash
docker compose ps                              # frontend / backend 都 Up（healthy）
curl -s -o /dev/null -w "home=%{http_code}\n" http://localhost:8080/        # 200＝前端就绪
curl -s -o /dev/null -w "api=%{http_code}\n" -X POST http://localhost:8080/api/profile  # 400/401＝反代到后端成功（非 502/404）
docker compose logs --tail=30 backend          # 无 panic / 监听 23020
```

- **本机访问**：`http://localhost:8080/`。
- **局域网访问**：查主机 IP（`ipconfig` / `ip a` / macOS `ipconfig getifaddr en0`），手机或同网段电脑打开 `http://<主机IP>:8080/`（端口绑 `0.0.0.0`）。
- 打开后用**小宇宙 App 扫码登录**（扫码走同源 `/qrcode-api` 代理，局域网下同样可用）。
- 冒烟通过后，把局域网地址交付给用户。

## 8. 常见坑（Agent 自查表）

| 现象 | 原因 / 处理 |
|---|---|
| `docker pull` 前端基础镜像超时 / `registry-1.docker.io` 不通 | 国内未配 registry-mirrors，或配了已失效源；按第 5 节 A 配 DaoCloud 并 `docker pull alpine` 实测 |
| 拉取后端镜像 `ghcr.io/...` 失败 | 国内 ghcr 不通；用代理（第 5 节 B），或改离线 fallback；DaoCloud ghcr 镜像站本镜像不在白名单、不可用 |
| （仅离线 fallback）构建卡在 `git clone ultrazg/xyz` | 国内 GitHub 不通；按第 5 节 B.4 用代理或实测可用的 GitHub 镜像覆盖 `XYZ_REPO` |
| （仅离线 fallback）`go mod download` 失败 | GOPROXY 已内置 goproxy.cn，通常是镜像源没生效或网络全断；先解决基础网络 |
| Docker Desktop 启动报 `virtualisation support was not detected` | BIOS 未开 VT-x/AMD-V，或 WSL2/虚拟机平台未启用；按第 4 节 Windows 处理 |
| `wsl` 命令报错 / 内核太旧 | 管理员 `wsl --update`；仍不行 `wsl --install` 后重启 |
| 配了镜像源但 `docker pull` 仍走官方源 | JSON 格式错误被引擎丢弃，或 Desktop 未 Apply & Restart；`docker info` 核对 + 重拉验证 |
| 8080 端口被占用 | 改 `docker-compose.yml` 的 `frontend.ports`（如 `18080:80`）后重新 `up -d` |
| `all predefined address pools have been fully subnetted` | 主机 docker 网络过多（常见于跑了多个项目的构建机）；`docker network ls` 排查，`docker network prune` 清理**确认无用**的网络（勿误删在用网络） |
| 页面能开但接口 502 | 后端没起 / 还在构建；`docker compose ps` + `logs backend` 确认监听 23020 |
| 接口 404（首页 tab / 评论增强 / 增量同步等） | 后端镜像不对（没含 22 条补丁）；确认 compose 用 `ghcr.io/simiooo/xyzus-backend` 并 `up -d` 重新拉取；离线 fallback 则用 `backend.Dockerfile` 重新构建（见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)） |