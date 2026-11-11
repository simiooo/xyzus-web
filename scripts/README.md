# `scripts/` —— 无头浏览器截图与 Mock 服务

全队视觉验收用的脚本（零依赖，不引入 puppeteer / playwright）。

```
scripts/
├─ shot.mjs        唯一截图实现：单页截图（CDP，支持桌面/移动/整页/自定义等待）
├─ shoot-all.mjs   全站路由批量截图（桌面 + 移动，输出到 shots/）
├─ mock-server.mjs 独立 Mock HTTP 服务（和 src/mock/handlers.ts 共用 fixtures）
└─ cdp-shot.mjs    Lead 最初脚本的兼容外壳，内部转调 shot.mjs（不再有第二套实现）
```

## 前置：起 dev server

```sh
pnpm dev                     # http://127.0.0.1:5173
```

Mock 数据三种来源（详见 `src/mock/README.md`）：

1. `VITE_API_MOCK=1 pnpm dev`（Lead 在 `src/alova.ts` 接入后）；
2. 浏览器打开 `http://127.0.0.1:5173/?mock=1`（运行时开关）；
3. `node scripts/mock-server.mjs` 占住 23020 端口，dev 代理自动把 `/api/*` 转过去。

> `shot.mjs` 自己还会用 CDP 拦截 `http://<target-origin>/api/*` 并直接回 fixtures，
> 所以截图这一步**不依赖**上面任何一种接入是否已完成，页面都能拿到完整 mock 数据。

## 单页截图

```sh
# 桌面 1440×900
node scripts/shot.mjs --url http://127.0.0.1:5173/ --out shots/home.png

# 移动端 390×844（CDP device metrics，不是 --window-size）
node scripts/shot.mjs --url http://127.0.0.1:5173/ --mobile --out shots/home-mobile.png

# 整页截图 + 加载完成后再等 2 秒
node scripts/shot.mjs --url http://127.0.0.1:5173/episode/mock-eid --full --wait 2000 --out shots/episode-full.png

# 登录页（不种 mock token）
node scripts/shot.mjs --url http://127.0.0.1:5173/login --no-auth --out shots/login.png
```

参数：`--url --out --width --height --mobile --scale --full --wait --idle --timeout`、
`--auth/--no-auth`、`--mock/--no-mock`、`--api-mock/--no-api-mock`、`--api-delay`、
`--token/--refresh-token`、`--chrome`、`--keep-profile`、`--headful`、`--json`、`--quiet`、`--debug`。

输出 JSON 里有 `pngWidth/pngHeight`、`horizontalOverflow`、`exceptions`、`timedOut`，
排查「数据没渲染出 / 横向溢出 / 页面异常」时先看它。

### 移动端尺寸怎么来的（重点）

- **不用 `--window-size`**：Windows 上 Chrome 有 ~500px 的最小窗口宽度，
  `--window-size=390,844` 的真实视口会被撑到 ~500，再裁成 390 宽 → 右侧内容被切，
  看起来像「内容溢出」的假 bug。
- 正确做法：`Emulation.setDeviceMetricsOverride({width:390,height:844,deviceScaleFactor:2,mobile:true})`
  + `Emulation.setTouchEmulationEnabled` + iPhone UA。
- 因此 `--mobile` 输出 PNG 是 **780×1688**（CSS 视口正好 390×844，dsf=2）；
  想要精确 390×844 的 PNG，加 `--scale 1`。

## 全站批量截图

```sh
node scripts/shoot-all.mjs                   # 12 路由 × 桌面 + 移动 = 24 张
node scripts/shoot-all.mjs --full          # 整页截图
node scripts/shoot-all.mjs --only home,episode,login --mobile-only
node scripts/shoot-all.mjs --base-url http://127.0.0.1:5173 --out-dir shots
```

路由清单见 `shoot-all.mjs` 的 `ROUTES`：home / search / search-keyword / categories /
category-arts / toplist-hot / editor-picks / podcast / episode / favorites /
subscriptions / login。输出命名 `<route>-desktop.png` / `<route>-mobile.png`。

## 稳定性设计（这些坑都踩过）

- Chrome `--user-data-dir` 放在 **系统临时目录**（`os.tmpdir()/chrome-xyz-shot-<pid>-<time>`），
  **绝不放工作区**：否则 Vite watcher 读到 Chrome 锁文件会 `EBUSY` 崩掉 dev server；
  目录带 `pid+时间戳`，两个截图进程不会共用 profile 互杀，退出时清理。
- 退出前 `try/finally` 杀 Chrome 进程树（Windows `taskkill /T /F`），不残留进程。
- 连不上 dev server 时明确提示「dev server 未启动：先运行 pnpm dev…」。
- 先等 `Page.loadEventFired`，再等网络空闲（图片/字体都回来），再等 React `#root` 有内容，
  最后按 `--wait` 额外等待；任何阶段超时都会尽力截一张并标记 `timedOut`。
- 截图前自动种 mock token（`--no-auth` 关闭）并在 localStorage / `window.__XYZ_MOCK__`
  打开 mock，SPA 内部跳转仍保持 mock。
