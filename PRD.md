# 小宇宙 Web 客户端 — 产品需求文档 (PRD)

> 版本：v1.0  
> 日期：2026-05-31  
> 技术栈：React 19 + TypeScript + Ant Design 6 + Alova + Zustand + React Router 7 + Vite

> **2026-11 维护后说明（读这里再看下文）**：本文档是 v1.0 的需求记录，其中 **§15 UI 布局规划、
> §17 的「主题跟随品牌色」、以及部分接口描述已经过期**。维护后的实际情况以这两份为准：
>
> - 界面：白底墨字的极简语言、蓝/粉两版强调色（只用于播放）、新布局与图片渐进加载
>   → [`docs/DESIGN.md`](docs/DESIGN.md)
> - 接口契约、归一化规则、登录风控与部署 → [`README.md`](README.md)（§4 契约总表、§5 登录、§8 部署）
>
> 产品范围（认证、内容浏览与搜索、评论互动三大模块）与本文一致；新增了订阅列表页、播放器
> （播放条 + 展开面板）、主题切换与离线 Mock 数据层。

---

## 1. 项目概述

基于小宇宙 API 实现 Web 端播客客户端，核心范围包括：**认证登录**、**内容浏览与搜索**、**评论互动**三大模块。客户端面向已注册小宇宙的用户，需通过手机号+验证码登录后使用。

---

## 2. 认证模块

### 2.1 登录页面 `/login`

#### 用户故事

1. 用户打开应用，若未登录则自动跳转到登录页
2. 用户输入手机号、区号（默认 +86），点击「发送验证码」
3. 系统调用 `POST /sendCode` 发送短信验证码，按钮进入 60 秒倒计时
4. 用户输入收到的验证码，点击「登录」
5. 系统调用 `POST /login`，成功后将 `x-jike-access-token` 和 `x-jike-refresh-token` 存入 localStorage / Zustand store
6. 登录成功后跳转到首页

#### Token 刷新机制

- 所有请求在 header 中携带 `x-jike-access-token`
- 当请求返回 `401` 时，自动使用 `POST /refresh_token` 用当前的 access-token + refresh-token 换取新 token
- 刷新成功后重试原请求；刷新失败则跳转到登录页

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/sendCode` | POST | 发送短信验证码 |
| `/login` | POST | 手机号+验证码登录，返回 access-token 和 refresh-token |
| `/refresh_token` | POST | 刷新 token，传入 x-jike-access-token 和 x-jike-refresh-token |
| `/profile` | POST | 登录后获取当前用户信息（uid、昵称、头像等） |

#### 前置逻辑

1. 应用启动时检查 localStorage 中的 token
2. 有 token → 调用 `/profile` 验证有效性；有效则直接进入首页
3. 无 token 或失效 → 跳转登录页

---

## 3. 首页模块

### 3.1 首页 `/`

#### 用户故事

1. 用户进入首页，看到推荐内容瀑布流
2. 内容来源于 `POST /discovery`，不传 `loadMoreKey` 时返回「大家都在听」和「编辑精选」两个板块
3. 每个板块是一个卡片组：标题 + 横向滚动列表（Podcast 卡片 / Episode 卡片）
4. 点击 Podcast 卡片 → 跳转节目详情 `/podcast/:pid`
5. 点击 Episode 卡片 → 跳转单集详情 `/episode/:eid`

#### 板块分类

`/discovery` 的 `loadMoreKey` 参数控制返回内容：

| loadMoreKey 值 | 返回内容 |
|---|---|
| 不传 | 「大家都在听」+ 「编辑精选」 |
| `mediumDiscoveryPictorial` | 「最热榜」「锋芒榜」「新星榜」|
| `discoveryTopic` | 「为你精选的节目」等 4 个板块 |
| `pick` | 「TA 们的喜欢」「TA 们开始创作新播客」 |

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/discovery` | POST | 首页推荐、精选、榜单等，通过 loadMoreKey 加载更多板块 |
| `/top_list` | POST | 榜单详情（HOT 最热榜 / ROCK 锋芒榜 / NEW 新星榜），返回单集列表 |
| `/pilot_discovery_list` | POST | 新节目广场，返回单集列表 |

---

## 4. 节目模块

### 4.1 节目详情 `/podcast/:pid`

#### 用户故事

1. 用户从首页/搜索/单集等入口点击节目，进入节目详情页
2. 页面顶部展示：节目封面、标题、作者、简介、订阅数、订阅按钮
3. 中部显示「相关节目推荐」横向卡片列表
4. 下方为该节目的单集列表，支持排序（从新到旧 / 从旧到新），分页加载
5. 点击单集 → 跳转单集详情 `/episode/:eid`

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/podcast_detail` | POST | 根据 pid 查询节目详情 |
| `/episode_list` | POST | 根据 pid 查询节目下单集列表，支持 order(asc/desc) 和 loadMoreKey 分页 |
| `/podcast_related` | POST | 根据 pid 查询推荐的相关节目列表 |
| `/podcast_get_info` | POST | 获取节目 IP 属地、主体信息等 |

---

## 5. 单集模块

### 5.1 单集详情 `/episode/:eid`

#### 用户故事

1. 用户点击单集卡片进入单集详情页
2. 页面展示：单集标题、封面图、所属节目信息、发布日期、播放时长、播放次数、点赞数、评论数、收藏数、描述（description）、shownotes（HTML 富文本）
3. 底部显示「最受欢迎单集」标签的列表入口（可选）
4. 点击评论区域 → 展开评论列表
5. 支持收藏操作

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/episode_detail` | POST | 根据 eid 查询单集详情 |
| `/episode_list_by_filter` | POST | 根据节目 pid 查询「最受欢迎」单集列表 |
| `/favorite_episode_update` | POST | 收藏/取消收藏单集（eid + favorited: boolean） |
| `/favorite_episode_list` | POST | 查询已收藏单集列表（我的收藏页） |

---

## 6. 搜索模块

### 6.1 搜索页 `/search`

#### 用户故事

1. 用户点击搜索入口进入搜索页
2. 进入搜索页时，显示搜索框和「你可能想搜的内容」标签列表（来自 `/search_preset`），点击标签直接搜索
3. 用户输入关键词后提交搜索
4. 搜索结果 Tab 分为：全部 / 节目 / 单集 / 用户
5. 搜索全部时（type=ALL），结果混合展示：HEADER（板块标题）→ PODCAST 结果 → FOOTER → HEADER → EPISODE 结果 → FOOTER → HEADER → SEARCHED_USERS
6. 切换到节目/单集/用户 Tab 后，使用对应 type 重新搜索
7. 单集搜索结果支持分页（loadMoreKey）
8. 搜索框支持在节目内搜索单集（传入 pid + type=EPISODE）

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/search` | POST | 搜索内容，支持 ALL/PODCAST/EPISODE/USER 类型，支持 pid 参数限定节目内搜索 |
| `/search_preset` | POST | 获取搜索预设词 |

---

## 7. 评论模块

### 7.1 单集评论列表（嵌入单集详情页）

#### 用户故事

1. 在单集详情页，用户可以看到该单集的评论列表
2. 评论排序支持：热门（HOT）/ 最新（TIME）/ 时点（TIMESTAMP）
3. 每条评论显示：用户头像、昵称、IP 属地、评论内容、点赞数、回复数、是否收藏、是否点赞、发布时间
4. 展开「回复」可查看该评论的回复列表
5. 点击某条评论可展开回复面板
6. 支持分页加载

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/comment_primary` | POST | 查询单集评论（eid + order），支持 loadMoreKey 分页 |
| `/comment_thread` | POST | 查询评论回复列表（primaryCommentId + order SMART/TIME） |

### 7.2 创建评论

#### 用户故事

1. 在评论列表底部点击「写评论」按钮
2. 弹出评论输入框，输入文本后提交
3. 创建一级评论：type=EPISODE, id=eid, text=评论内容
4. 回复评论：额外传入 replyToCommentId=被回复评论 id
5. 提交成功后刷新评论列表

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/comment_create` | POST | 创建评论（text, id, type=EPISODE, replyToCommentId 可选） |

### 7.3 点赞评论

#### 用户故事

1. 用户点击评论的「点赞」按钮，点赞该评论
2. 再次点击取消点赞
3. 点赞类型：type=COMMENT 评论点赞，type=PICK 对「TA 的喜欢」点赞

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/comment_like_update` | POST | id=评论 id, liked=true/false, type=COMMENT/PICK |

### 7.4 删除评论

#### 用户故事

1. 用户只能删除自己发表的评论
2. 在自己的评论上显示删除按钮
3. 点击删除后弹出确认，确认后调用接口删除

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/comment_remove` | POST | commentId=评论 id |

### 7.5 收藏评论

#### 用户故事

1. 用户点击评论的「收藏」按钮，收藏该评论
2. 再次点击取消收藏
3. 在「我的收藏」页面可查看已收藏的评论列表，支持分页

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/comment_collect_create` | POST | 收藏评论（commentId） |
| `/comment_collect_remove` | POST | 取消收藏评论（commentId） |
| `/comment_collect_list` | POST | 查询已收藏评论列表，支持 loadMoreKey 分页 |

---

## 8. 榜单与分类模块

### 8.1 榜单

#### 用户故事

1. 首页「最热榜」「锋芒榜」「新星榜」入口 → 点击进入榜单详情页 `/toplist/:category`
2. 三个榜单分别对应 category: HOT / ROCK / NEW
3. 榜单页面顶部展示背景图、标题、说明、规则链接、更新时间
4. 下方展示单集卡片列表，可点击进入单集详情

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/top_list` | POST | category=HOT/ROCK/NEW |

### 8.2 编辑精选

#### 用户故事

1. 首页「编辑精选」板块 → 点击查看更多 → 精选历史列表页 `/editor-picks`
2. 按日期分组展示，每天一组精选（包含编辑评语 + 单集信息）
3. 支持通过 loadMoreKey 分页加载更早的精选

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/editor_pick_list_history` | POST | 编辑精选历史，支持 loadMoreKey 分页 |

### 8.3 分类浏览

#### 用户故事

1. 首页提供分类入口 → 点击进入分类列表页 `/categories`
2. 展示所有分类（emoji + 名称）
3. 点击分类 → 进入分类详情页 `/category/:id`，展示该分类下的节目列表
4. 支持根据标签 tab 筛选，分页加载

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/category_list` | POST | 获取全部分类 |
| `/category_list_tab` | POST | 获取分类下的标签 |
| `/category_podcast_list` | POST | 分类下的节目列表（categoryId + tab），支持 loadMoreKey 分页 |

---

## 9. 收藏与喜欢模块

### 9.1 我的收藏（单集）

#### 用户故事

1. 用户在个人中心查看已收藏的单集列表 `/favorites`
2. 展示单集卡片列表，点击可进入单集详情
3. 在单集详情页可点击收藏/取消收藏

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/favorite_episode_list` | POST | 已收藏单集列表 |
| `/favorite_episode_update` | POST | 收藏/取消收藏（eid + favorited: boolean） |

### 9.2 用户的喜欢（Pick）

#### 用户故事

1. 在用户个人页查看「TA 的喜欢」列表
2. 展示喜欢记录：用户标记内容 + 单集信息 + 点赞数 + 是否已点赞

#### 涉及 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/pick_recent` | POST | 用户的喜欢片段（uid） |

---

## 10. 页面路由总结

| 路由 | 页面 | 是否需登录 |
|------|------|-----------|
| `/login` | 登录页 | 否 |
| `/` | 首页（发现） | 是 |
| `/toplist/:category` | 榜单详情（HOT/ROCK/NEW） | 是 |
| `/podcast/:pid` | 节目详情 | 是 |
| `/episode/:eid` | 单集详情（含评论） | 是 |
| `/search` | 搜索页 | 是 |
| `/categories` | 分类列表 | 是 |
| `/category/:id` | 分类节目列表 | 是 |
| `/editor-picks` | 编辑精选历史 | 是 |
| `/subscriptions/:uid?` | 我的订阅 / TA 的订阅 | 是 |
| `/inbox` | 消息（收件箱 / 未读数） | 是 |
| `/favorites` | 我的收藏 | 是 |

---

## 11. 全局状态管理 (Zustand Store)

### 11.1 Auth Store

```
- accessToken: string | null
- refreshToken: string | null
- user: UserProfile | null
- isAuthenticated: boolean
- login(phone, code): Promise<void>
- sendCode(phone, areaCode): Promise<void>
- refreshToken(): Promise<void>
- logout(): void
- checkAuth(): Promise<void>  // 启动时验证
```

### 11.2 App Store

```
- searchHistory: string[]
- addSearchHistory(keyword): void
- clearSearchHistory(): void
```

### 11.3 Notification Store（2026-11 新增）

```
- unreadCount: number              // /unread_count 返回的数字（只有数量）
- seenCount: number                // 本机已读水位（localStorage: xyz:notification-seen-count）
- seenPending: boolean             // 未读数还没取到就打开了消息页
- refresh(): Promise<number>       // 同一时刻只发一个请求
- markAllSeen(): void              // 打开收件箱时把当前未读数记为已看
// 徽标显示条件：unreadCount > seenCount；没有已读接口，所以是「本机水位 + 服务端增量」模型
```

---

## 12. 请求层设计 (Alova)

### 12.1 基础配置

- BaseURL: 从环境变量 `VITE_API_BASE_URL` 读取
- 所有请求默认 Header 携带 `x-jike-access-token`
- 响应拦截器：遇到 401 自动执行 refresh_token 逻辑后重试
- 统一错误处理：antd message 展示错误提示

### 12.2 API 模块划分

```
src/api/
  ├── auth.ts          # sendCode, login, refreshToken, profile
  ├── discovery.ts     # discovery, topList, editorPickListHistory, pilotDiscoveryList
  ├── podcast.ts       # podcastDetail, podcastRelated, podcastGetInfo, episodeList, episodeListByFilter
  ├── episode.ts       # episodeDetail, updateEpisodeFavorite, episodeFavoriteList
  ├── search.ts        # search, searchPreset
  ├── comment.ts       # commentPrimary, commentThread, commentCreate, commentRemove, commentLikeUpdate, commentCollectCreate, commentCollectRemove, commentCollectList
  ├── category.ts      # categoryList, categoryListTab, categoryPodcastList
  ├── inbox.ts         # inboxList（收件箱 / 订阅更新）, unreadCount（未读消息数）
  ├── user.ts          # getProfile, pickRecent
  └── types.ts         # 所有接口的 TypeScript 类型定义
```

---

## 13. 核心数据模型 (TypeScript Types)

### 13.1 通用类型

```typescript
interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

interface ImageUrls {
  picUrl: string
  largePicUrl: string
  middlePicUrl: string
  smallPicUrl: string
  thumbnailUrl: string
  format?: string
  width?: number
  height?: number
}

interface UserBasic {
  type: 'USER'
  uid: string
  avatar: { picture: ImageUrls }
  nickname: string
  isNicknameSet: boolean
  bio?: string
  gender?: 'MALE' | 'FEMALE'
  isCancelled: boolean
  readTrackInfo: Record<string, unknown>
  ipLoc?: string
  relation: 'STRANGE' | 'FOLLOWING'
  isBlockedByViewer: boolean
}

interface PodcastBasic {
  type: 'PODCAST'
  pid: string
  title: string
  author: string
  brief?: string
  description: string
  subscriptionCount: number
  image: ImageUrls
  color: { original: string; light: string; dark: string }
  topicLabels: string[]
  syncMode: string
  episodeCount: number
  latestEpisodePubDate: string
  subscriptionStatus: 'ON' | 'OFF'
  subscriptionPush: boolean
  subscriptionPushPriority: string
  subscriptionStar: boolean
  status: 'NORMAL' | string
  permissions: { name: string; status: string }[]
  payType: 'FREE' | string
  payEpisodeCount: number
  podcasters: UserBasic[]
  readTrackInfo: Record<string, unknown>
  hasPopularEpisodes: boolean
  contacts: { type: string; name: string; note?: string; url?: string }[]
  isCustomized: boolean
}

interface EpisodeBasic {
  type: 'EPISODE'
  eid: string
  pid: string
  title: string
  shownotes?: string
  description: string
  image?: ImageUrls
  enclosure: { url: string }
  isPrivateMedia: boolean
  mediaKey: string
  media: {
    id: string
    size: number
    mimeType: string
    source: { mode: string; url: string }
  }
  clapCount: number
  commentCount: number
  playCount: number
  favoriteCount: number
  pubDate: string
  status: string
  duration: number
  podcast: PodcastBasic
  isPlayed: boolean
  isFinished: boolean
  isPicked: boolean
  isFavorited: boolean
  permissions: { name: string; status: string }[]
  payType: string
  labels: { name: string; code: string }[]
  sponsors: unknown[]
  isCustomized: boolean
  ipLoc?: string
}

interface Comment {
  id: string
  type: 'COMMENT'
  owner: { id: string; type: string }
  thread?: string
  author: UserBasic
  authorAssociation: string
  text: string
  level: number
  likeCount: number
  liked: boolean
  collected: boolean
  createdAt: string
  status: string
  permissions: { name: string; status: string }[]
  pid: string
  pinned: boolean
  isAuthorMuted: boolean
  entities: unknown[]
  badges: unknown[]
  ipLoc?: string
  threadReplyCount?: number
  replies?: Comment[]
  replyToComment?: Comment
}
```

---

## 14. 交互流程详述

### 14.1 登录完整流程

```
1. 用户进入应用
   ├── 有 token → 调用 /profile 验证
   │   ├── 成功 → 存储用户信息，进入首页
   │   └── 失败 → 尝试 /refresh_token
   │       ├── 成功 → 存储新 token，进入首页
   │       └── 失败 → 清除 token，跳转 /login
   └── 无 token → 跳转 /login

2. 登录页
   ├── 输入手机号 → 点击「发送验证码」
   │   └── POST /sendCode { mobilePhoneNumber, areaCode }
   │       ├── 成功 → 60 秒倒计时，提示「验证码已发送」
   │       └── 失败 → 提示错误信息（如手机号未注册）
   ├── 输入验证码 → 点击「登录」
   │   └── POST /login { mobilePhoneNumber, verifyCode, areaCode }
   │       ├── 成功 → 存储 token + 用户信息 → 跳转首页
   │       └── 失败 → 提示「验证码错误」等
   └── 登录成功后流程
       ├── 存储 x-jike-access-token, x-jike-refresh-token 到 localStorage
       ├── 调用 /profile 获取完整用户信息
       └── 重定向到首页或之前被拦截的页面
```

### 14.2 首页加载流程

```
1. 进入首页
   ├── 调用 /discovery（无 loadMoreKey）→ 获取「大家都在听」+「编辑精选」
   ├── 解析响应数据中的板块结构：
   │   ├── DISCOVERY_COLLECTION 类型 → 包含子板块（title, moduleType, target）
   │   │   ├── targetType=PODCAST → 展示节目卡片横向滚动列表
   │   │   └── targetType=EPISODE → 展示单集卡片横向滚动列表
   │   └── NEW_POWER 类型 → 新力量榜单
   ├── 继续调用 /discovery { loadMoreKey: "mediumDiscoveryPictorial" }
   │   └── 获取「最热榜」「锋芒榜」「新星榜」数据
   └── 继续调用 /discovery { loadMoreKey: "discoveryTopic" }
       └── 获取「为你精选的节目」等板块
```

### 14.3 搜索流程

```
1. 进入搜索页 → 调用 /search_preset 展示推荐搜索词
2. 输入关键词 + 选择类型 → 调用 /search
   ├── type=ALL → 混合结果（HEADER + PODCAST + EPISODE + SEARCHED_USERS）
   ├── type=PODCAST → 仅节目结果
   ├── type=EPISODE → 仅单集结果（支持 loadMoreKey 分页）
   └── type=USER → 仅用户结果
3. 点击节目 → 跳转 /podcast/:pid
4. 点击单集 → 跳转 /episode/:eid
5. 点击用户 → 跳转用户主页（暂不做，可展示基本信息）
```

### 14.4 评论交互流程

```
1. 进入单集详情页 → 底部展示评论入口
2. 点击评论区域 → 加载评论列表
   ├── 调用 /comment_primary { eid, order: "HOT" }
   ├── 展示评论列表：头像、昵称、内容、点赞数、回复数、时间、IP 属地
   ├── 每条评论支持：点赞/取消赞、收藏/取消收藏
   └── 点击评论展开回复
       └── 调用 /comment_thread { primaryCommentId, order: "SMART" }
3. 发表评论
   ├── 输入文本 → POST /comment_create { type: "EPISODE", text, id: eid }
   └── 回复评论 → POST /comment_create { ..., replyToCommentId }
4. 删除评论（仅自己的评论可见删除按钮）
   └── POST /comment_remove { commentId }
5. 点赞/取消点赞
   └── POST /comment_like_update { id, liked: true/false, type: "COMMENT" }
6. 收藏/取消收藏
   ├── POST /comment_collect_create { commentId } → 收藏
   └── POST /comment_collect_remove { commentId } → 取消收藏
```

---

## 15. UI 布局规划

### 整体布局

```
┌─────────────────────────────────┐
│           顶部导航栏             │
│  Logo  |  搜索框  |  用户头像    │
├─────────────────────────────────┤
│                                 │
│         主内容区域               │
│      (React Router Outlet)      │
│                                 │
├─────────────────────────────────┤
│    底部导航栏 (仅移动端)         │
│  首页 | 发现 | 收藏 | 我的      │
└─────────────────────────────────┘
```

### 关键页面布局

**首页**：垂直滚动的板块列表，每个板块包含标题 + 横向卡片区

**搜索页**：搜索框 + 预设标签 + 结果列表（Tab 切换：全部/节目/单集/用户）

**节目详情**：节目标题区 → 节目信息卡 → 推荐节目横滑 → 单集列表（排序切换+无限滚动）

**单集详情**：单集信息区 → shownotes 富文本 → 评论列表（排序切换+分页）→ 评论输入框

**榜单详情**：背景图 + 榜单说明 → 单集列表

---

## 16. 错误处理与边界情况

1. **Token 过期**：自动 refresh，refresh 也失败则跳转登录
2. **网络错误**：antd message 提示「网络错误，请稍后重试」
3. **空状态**：搜索无结果、评论为空、收藏为空等展示空状态插画+文案
4. **加载状态**：所有列表使用 Ant Design Skeleton / Spin 组件
5. **无限滚动/分页**：使用 Intersection Observer 实现滚动加载更多
6. **验证码冷却**：发送后 60 秒内禁用按钮并显示倒计时
7. **HTML 富文本渲染**：shownotes 为 HTML，需过滤 XSS 后使用 dangerouslySetInnerHTML 渲染，或使用轻量 HTML 解析组件

---

## 17. 非功能需求

1. **响应式设计**：优先适配移动端（375px~428px），桌面端可用
2. **国际化**：暂不需要，默认中文
3. **主题**：跟随小宇宙品牌色调（可提取 podcast.color 作为页面强调色）
4. **性能**：列表虚拟滚动（单集列表超过 100 条时）、图片懒加载、路由懒加载

---

## 18. 不在范围内

以下功能本版本**不做**：

- 音频播放器（播放进度、播放状态管理等）
- 订阅/取消订阅节目
- 关注/取关用户
- 用户个人主页（他人主页）
- 收听历史、收听数据统计
- 贴纸系统
- 深色模式
- PWA 离线缓存

---

## 19. 消息中心增补（2026-11，原第 18 节不再排除）

### 19.1 范围

消息页做成「通知 / 收件箱」双 tab。收件箱复用既有端点；互动通知的列表上游存在（APK 3.4.2
`/v1/notice/list`，静态合同见 `docs/API_INVENTORY.md` §2.1），xyz 原本没代理，本期以补丁形式补上：

| 端点 | 上游 / 返回 | 用途 | 状态 |
|---|---|---|---|
| `POST /notice_list` | `/v1/notice/list` → `{data: Notice[], loadMoreKey?}` | 互动通知列表 | xyz 补丁新增，前端已接（字段待抓包校准） |
| `POST /inbox_list` | `/v1/inbox/list` → `{data: EpisodeBasic[], loadMoreKey?}` | 收件箱订阅更新 | 既有，前端已接 |
| `POST /unread_count` | `/v1/unread-count/get` → `{data:{unreadCount}}` | 未读消息数（只有数字） | 既有，前端已接 |
| `POST /inbox_remove` | `/v1/inbox/remove` → body `{eids}` | 收件箱移除 / 已读 | xyz 补丁新增，API 已导出、UI 暂未接（语义待抓包确认） |
| `POST /system_notice_list` | `/api/systemNotice/systemNotice/list` | 系统通知列表 | xyz 补丁新增，UI 暂未接 |
| `POST /system_notice_unread` | `/api/systemNotice/unread/get` | 系统通知未读数 | xyz 补丁新增，UI 暂未接 |

后端补丁：`backend-patches/notification-endpoints.patch`（`handlers/notification.go` + 路由 4 行），
`backend.Dockerfile` 在 pin 住的上游 commit 上 `git apply` 后构建；本机在干净 clone 上验证过 apply + `go build`。

### 19.2 页面 `/inbox`

- 左栏「消息」与移动端顶栏铃铛进入；左栏行尾 / 铃铛右上角显示墨色未读徽标（`unreadCount > seenCount` 时）。
- 页头「消息」+ 随页签切换的小字；下面一对文字页签「通知 / 收件箱」，默认通知。
- **通知**：点赞 / 回复 / 关注 / 未知四类行（头像 + 谁 + 动作 + 摘要 + 相对时间）；有单集可跳时整行可点。
  `source` / `target` 是多态结构，抓包前用安全提取 helper 容错，未知结构降级成「一位听友 / 和你互动了」。
- **收件箱**：按发布日分组（今天 / 昨天 / 日期），组内单集行，滚动到底自动加载。
- 两个 tab 各自维护分页状态，切换不丢数据、不重复请求；打开页面即把当前未读数记为本机已看。
- 空 / 错 / 加载：各自空态 + 中文错误重试 + 行骨架。

### 19.3 明确的限制（不是 bug）

- **没有已读接口**：上游没有标记已读端点，服务端数字不会因阅读减少；徽标按「本机已读水位 + 服务端增量」
  显示，换设备 / 清 localStorage 会重新显示。通知列表拉取是否由服务端清零 `/unread_count` 仍待抓包确认。
- **通知字段待抓包校准**：`action` 枚举值、`source` / `target` 的 TypeData 结构、分页 `loadMoreKey` 形状、
  触发者信息在哪一侧，目前按 APK 静态合同 + 容错提取实现；真实响应回来后应收紧为精确解析。
- **系统通知 / 收件箱移除未做 UI**：后端端点已备，界面暂未接入。
- 没有 WebSocket / 推送：未读数靠「进入应用 + 窗口聚焦 + 切回标签页 + 2 分钟轮询」刷新。

### 19.4 离线 Mock

`notice_list`（14 条、四类 action 混合、6 条/页）与 `inbox_remove`（返回 null）已加入 mock；
`inbox_list` 6 条/页（共 14 条）与 `unread_count` 固定 3 维持原状。
`VITE_API_MOCK=1 pnpm dev` 即可完整验收双 tab、分页、徽标与空态。

---

## 20. 发现页 / 相关单集 / 收件箱 v2（2026-11 增补，发现页后按 X 式重构）

### 20.1 目标

对齐小宇宙 App 3.4.2 的发现流与单集相关推荐，并把收件箱切到 App 实际使用的 v2 接口；
发现页随后按 X（Twitter）式布局重构，重新映射功能入口层级与布局。

### 20.2 后端（xyz 补丁，共 9 条代理路由）

在 `backend-patches/notification-endpoints.patch` 中追加（`backend.Dockerfile` 自动 apply）：

| 端点 | 上游 | 用途 |
|---|---|---|
| `/inbox_list_v2` | POST `/v2/inbox/list` | 收件箱 v2（`limit` + `{pubDate,id}` 游标） |
| `/tab_featured_list` | POST `/v1/tab/featured/list` | 首页「精选」tab |
| `/tab_discovery_list` | POST `/v1/tab/discovery/list` | 首页「发现」tab |
| `/tab_category_list` | POST `/v1/tab/category/list` | 首页「分类」tab |
| `/related_episode_list` | POST `/v1/related-episode/list` | 单集页相关单集 |

### 20.3 前端

- **发现页 `/`（X 式）**：页头大标题/副标题/「去榜单」取消，顶部改为吸顶内容流 tab；
  按使用频率排「为你推荐（默认）→ 关注 → 分类 → 精选」；榜单留在左栏主导航，不占内容流 tab。
  首屏只加载当前 tab，切换保留已加载数据；URL 同步 `?tab=following|category|featured`（无参数 = 为你推荐）。
  板块由容错渲染器消化（活动位、编辑精选、单集推荐、视频播客、三榜单、分类块；认不出的类型跳过），
  活动位按分层素材合成，且按官方定位（入口优先级低）在 **Web 全尺寸统一收成单行小胶囊**，不再用通栏/网格。
- **收件箱**：`/inbox_list_v2`（limit 25）；tab 右上角「全部标为已读」调用 `/inbox_remove` 后清空列表；
  `?messageTab=inbox` 可直接预览收件箱 tab。
- **单集页**：节目笔记之后、评论之前增加「相关单集」，最多 6 条，失败可重试。

### 20.4 Mock / 验收

- Mock：三个 feed tab 各两页（第二页由 `loadMoreKey` 触发）+ 关注 tab（`following_updates_list`）、
  `inbox_list_v2` 与 `related_episode_list` 均覆盖；`VITE_API_MOCK=1 pnpm dev` 可验收四 tab、吸顶、全部已读与相关单集。
- 截图：`shots/home-v3/`（四个 tab + 吸顶 + 移动端）、`shots/feature-check/`（收件箱 / 相关单集）。
- 限制：首页板块结构是多态 JSON，容错渲染保证换结构只少内容不白屏；通知已读语义仍用本机水位兜底。

---

## 21. 评论增强（2026-11 增补）

### 21.1 范围

- **回复 v2**：单集页回复列表切换到 `/comment_list_thread_v2`（上游 `/v1/comment/list-thread/v2`，
  body `{primaryCommentId, order:"SMART"}`，响应多 `totalCount`）。
- **我的评论**：新页面 `/my-comments`，账号菜单入口，走 `/comment_list_mine`（body `{order:"TIME"|"LIKE", limit}`，
  真实响应每条带 `episode`）；「最新 / 最热」两排序，只读列表，点整行进对应单集。
- **时点评论**：后端代理 `/comment_list_timestamp_primary`（body `{owner, from, to}`）→ 时点标记
  `{id,timestamp,type}`，并用新增 `/comment_get`（上游 GET `?commentId=`）逐条取正文；
  单集评论「时点」tab 按当前播放位置取 120s 窗口展示时点评论，seek 后自动刷新，点时间戳可跳播。

### 21.2 后端补丁

`backend-patches/notification-endpoints.patch` 扩到 **12 条代理路由**（9724 B），新增：

| 端点 | 上游 | 用途 |
|---|---|---|
| `/comment_list_thread_v2` | POST `/v1/comment/list-thread/v2` | 评论回复 v2 |
| `/comment_list_mine` | POST `/v1/comment/list-mine` | 我的评论 |
| `/comment_list_timestamp_primary` | POST `/v1/comment/list-timestamp-primary` | 时点评论标记 |

### 21.3 验收

- 真实 token + App 设备头实测三条端点全部 **200**（`comment_list_mine` 返回 3 条带 episode 的评论）。
- Mock 增加三个 handler 与「我的评论」fixture；`VITE_API_MOCK=1 pnpm dev` 可验收我的评论页与回复加载。
- 截图：`shots/comment-check/`（mock / 真实数据两版）；`pnpm lint` / `tsc -b` / `pnpm build` 全绿。

---

## 22. AI 摘要与文字稿（2026-11 增补）

### 22.1 范围

- **AI 摘要**：单集页简介上方显示 `summary.brief`（`/ai_summary_episode_retrieve_brief`，上游
  `/v1/ai-summary/episode/retrieve-brief`）。只有 `status="ready"` 且有内容时展示；无摘要 / 429 / 失败静默隐藏。
- **AI 文字稿**：`/episode_transcript_get {eid, mediaId}` 拿 CDN 签名地址；展开时由后端
  `/episode_transcript_content {url}` 代取 CDN JSON（受限代理：只允许 transcript.xyzcdn.net /
  transcript-highlight.xyzcdn.net，8MB 上限），前端按 `[{text,startMs}]` 渲染时间轴段落，点一行跳播/seek。

### 22.2 后端补丁

`backend-patches/notification-endpoints.patch` 扩到 **15 条代理路由**（13784 B），本批新增：

| 端点 | 上游 | 用途 |
|---|---|---|
| `/ai_summary_episode_retrieve_brief` | POST `/v1/ai-summary/episode/retrieve-brief` | 单集 AI 摘要 |
| `/episode_transcript_get` | POST `/v1/episode-transcript/get` | 文字稿元数据（CDN 签名地址） |
| `/episode_transcript_content` | CDN `transcript.xyzcdn.net`（后端受限代理） | 文字稿正文 JSON |

### 22.3 验收

- 真实 token + App 设备头实测：摘要 200（ready，brief 93 字）；文字稿元数据 200；正文 200（787 段）。
- Mock：`ai_summary_episode_retrieve_brief` / `episode_transcript_get` / `episode_transcript_content`
  三个 handler + fixture；`VITE_API_MOCK=1 pnpm dev` 可验收展开/收起与跳播。
- 截图：`shots/ai-check/`（mock 与真实数据各一版，均含 AI 摘要与展开后的文字稿）。

---

## 23. 关注动态与常听节目（2026-11 增补）

### 23.1 范围

- **关注动态**：新页面 `/following`（账号菜单 + 我的订阅页头入口），数据
  `/following_updates_list`（真实抓包确认是 **POST** body `{}`，上游 `/v1/personal-update/list-following-updates`）。
  每条展示听友头像/昵称、「推荐了这期」、相对时间、推荐语（story.text）、以及被推荐单集行；只读。
- **常听节目**：「我的订阅」顶部横滑货架，`/subscription_often_played`（body `{limit:5}`，上游
  `/v1/subscription/list-often-played`），最多 5 个节目，点击进节目页；失败静默隐藏，别人订阅页不请求。

### 23.2 后端补丁

`backend-patches/notification-endpoints.patch` 扩到 **17 条代理路由**（14714 B），新增：

| 端点 | 上游 | 用途 |
|---|---|---|
| `/following_updates_list` | POST `/v1/personal-update/list-following-updates` | 关注动态 |
| `/subscription_often_played` | POST `/v1/subscription/list-often-played` | 常听节目 |

### 23.3 验收

- 真实 token + App 设备头实测：`following_updates_list` 200（1 条动态）、`subscription_often_played` 200（3 个节目）。
- Mock：两个 handler + fixtures（3 条动态 / 6 个常听节目）；`VITE_API_MOCK=1 pnpm dev` 可验收两处。
- 截图：`shots/following-check/`（关注动态、我的订阅，mock + 真实数据）。
- **播放列表暂缓**：抓包只有 `playlist/patch`（加单集 CAS），缺 `playlist/pull` 读取契约，需补抓后再做；
  已记入 API_INVENTORY §5 待补抓清单。

---

## 24. 星标订阅（2026-11 增补）

### 24.1 范围

- 仅自己的「我的订阅」页：订阅列表上方加「全部 / 星标」文字页签；行尾加星标按钮（已星标实心强调色、未星标空心灰）。
- 数据：`/subscription_star`（xyz 内置路由，上游 `/v1/subscription-star/list`）拉星标列表；
  `/subscription_star_update {pid, withStar}` 切换星标。全部列表的 `subscriptionStar` 字段直接驱动按钮。
- 交互：切换时两份列表乐观更新，失败回滚 + 中文提示；星标 tab 空态给「查看全部订阅」回到全部。
- `?filter=starred` 可直接预览星标 tab（截图/分享用）。

### 24.2 验证

- 真实 token 实测：`/subscription_star` 200（1 个）；`subscription_star_update` 星标 200、取消 200，
  星标数 1→2→1，测试账号已还原、未留改动。
- Mock：`subscription_star` / `subscription_star_update` 两个 handler（模块内可变 Set）；
  `VITE_API_MOCK=1 pnpm dev` 可验收筛选、切换与空态。
- 截图：`shots/star-check/`（全部 / 星标，mock + 真实数据）。
- 无新增后端补丁（xyz 原本已内置这两条路由）。

---

## 25. 播放现场同步 / 续听（2026-11 增补）

### 25.1 范围

对齐手机端的「分布式续听」：刷新、重开页面或换设备后，自动回到上次收听的那一集与原进度。

- **本地快照**：集快照 + 进度 + `playedAt` 节流写入 `localStorage: xyz:playback-state`；刷新/重开先立刻恢复
  （暂停态、原进度），不依赖网络。
- **跨端恢复**：登录态就绪后拉 `/episode_played_history_list`（最近收听）与 `/playback_progress_list`
  （服务端进度），按 `playedAt` 取最新记录恢复；远端明显更新时 toast 提示。
- **上报**：播放中每 10s、暂停、seek、页面隐藏/关闭时 `/playback_progress_update`（带 `playedAt`）；
  新集开始 `/episode_played_create` 记录收听。
- **冲突协调**：`playedAt` 最后写入优先；本端播放中不被远端覆盖，页面重新可见且本端暂停时若远端更新则自动 seek 并提示。
- 恢复为**暂停态**（浏览器禁止无手势自动播放），用户点播放从原进度继续。

### 25.2 后端补丁

`backend-patches/notification-endpoints.patch` 扩到 **21 条代理路由**（16393 B），本批新增：

| 端点 | 上游 | 用途 |
|---|---|---|
| `/playback_progress_list` | POST `/v1/playback-progress/list` | 批量取服务端进度 |
| `/playback_progress_update` | POST `/v1/playback-progress/update` | 上报进度（服务端按 playedAt 合并） |
| `/episode_played_create` | POST `/v1/episode-played/create` | 记录开始收听 |

`/episode_played_history_list` 是 xyz 原有路由，前端直接使用。

### 25.3 验证

- 真实账号：服务端恢复 2169s → Web seek 2229s → 服务端 list 读到 2229；用旧 `playedAt` 回写被服务端拒绝
  （LWW 生效）；测试账号进度已还原为 2169。
- 同一浏览器：写本地快照 → reload → 恢复到指定进度（90s）实测通过。
- 坑：上游用 **`local-time` 请求头**校验进度写入，固定旧值会 200 但静默丢弃；本机 xyz 已改为每次请求动态生成
  （在 `utils/http.go` 的本地设备头覆盖逻辑中，不入生产补丁）。
- 截图：`shots/playback-check/`（mock 恢复 02:00、真实数据恢复 36:09）。

---

## 26. 本地缓存与写队列（2026-11 增补，Phase 1 + Phase 2）

### 26.1 目标

减少重复请求、让刷新/返回接近原生，并把写操作做成可离线排队、可重试的增量更新；覆盖高价值读域和
播放/星标/订阅三类写操作。

### 26.2 方案

- 存储：Dexie 4 + IndexedDB（库 `xyz-web-db`），按账号 uid 隔离，不存 token / 音频 / 图片二进制；
- **Phase 1（读缓存）**：`entities` 存单集详情、节目详情+相关节目；`pages` 存首页三个 feed tab、订阅列表首页；
  读时先返回缓存并后台 `isFresh` 刷新，无缓存才骨架；TTL 单集 24h / 节目 12h / 首页 3–10min / 订阅 5min；
  启动清理 30 天未访问数据；
- **Phase 2（写队列）**：播放进度、星标、订阅写入先入 outbox（同账号+kind+实体合并为最新），
  700ms 调度、15s 兜底、可见/离开时 flush；播放进度批量合并；失败指数退避（1s 起、上限 5min、最多 8 次后拉长）；
- 失效：写成功后再失效订阅列表/节目详情缓存，避免缓存与写操作打架；缓存是加速层，服务端仍是真相源。

### 26.3 验证

- Mock 实测：首次访问后 IDB `entities=1 / pages=2`；API 延迟 3s 时二次打开 1.6s 内用缓存渲染完成（无骨架）；
- Outbox：点星标后落库 1 条、3s 内 flush 清空，同时 `subscriptionList` 缓存被失效；
- `pnpm lint` / `tsc -b` / `pnpm build` 全绿。
- 边界：首期只覆盖单集/节目详情、首页 feed、订阅列表；消息/评论等后续按域扩展。