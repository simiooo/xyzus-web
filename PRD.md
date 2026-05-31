# 小宇宙 Web 客户端 — 产品需求文档 (PRD)

> 版本：v1.0  
> 日期：2026-05-31  
> 技术栈：React 19 + TypeScript + Ant Design 6 + Alova + Zustand + React Router 7 + Vite

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
- 消息通知（收件箱、未读数）
- 深色模式
- PWA 离线缓存