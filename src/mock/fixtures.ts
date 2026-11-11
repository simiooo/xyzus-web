/**
 * 离线 Mock 数据层 —— 全量 fixtures
 *
 * 说明：
 * - 所有 shape 都是「alova 响应拦截器剥掉外层 { code, msg, data } 之后」的样子。
 *   例如 `/podcast_detail` 的 fixture 是 `{ data: PodcastBasic }`，因为 `podcastDetailAPI`
 *   的返回类型就是 `{ data: PodcastBasic }`。
 * - 图片全部使用真实可访问的 HTTPS 图片（picsum.photos 的固定 seed），并且每个 ImageUrls
 *   对象都填满 thumbnailUrl / smallPicUrl / middlePicUrl / largePicUrl / picUrl 五档，
 *   方便验收图片渐进加载组件。
 * - 内容全部为中文播客内容（标题、主播、简介、shownotes 富文本），贴合真实小宇宙数据。
 *
 * 这个文件只 import type（Node 24 的 type stripping 可以直接加载它，
 * 供 scripts/mock-server.mjs 复用同一份数据），不依赖任何运行时模块。
 */
import type {
  CategoryInfo,
  CategoryTab,
} from '@/api/category'
import type { Notice } from '@/api/notice'
import type {
  Comment,
  DiscoveryRawSection,
  DiscoveryResponse,
  EditorPickItem,
  EpisodeBasic,
  EpisodeDetail,
  ImageUrls,
  LoginResponse,
  PodcastBasic,
  PodcastRelatedItem,
  SearchPresetItem,
  UserBasic,
  UserProfile,
} from '@/api/types'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

const PICSUM_BASE = 'https://picsum.photos/seed'
const SAMPLE_AUDIO_URL =
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

/** 一个图片字段的五档尺寸（picsum 固定 seed，返回稳定的 HTTPS 图片） */
function createImageUrls(seed: string, maxSize = 1024): ImageUrls {
  const safeSeed = seed.replace(/[^a-zA-Z0-9_-]/g, '-')
  const size = (ratio: number) => Math.max(9, Math.round(maxSize * ratio))
  const url = (px: number) => `${PICSUM_BASE}/${safeSeed}/${px}/${px}`
  return {
    thumbnailUrl: url(size(0.0625)), // 64
    smallPicUrl: url(size(0.125)), // 128
    middlePicUrl: url(size(0.3125)), // 320
    largePicUrl: url(size(0.625)), // 640
    picUrl: url(maxSize), // 1024（最大图）
    format: 'jpeg',
    width: maxSize,
    height: maxSize,
  }
}

/** 横幅类宽图（discovery banner / hero），返回字符串 URL */
function wideImage(seed: string, width = 1600, height = 640): string {
  const safeSeed = seed.replace(/[^a-zA-Z0-9_-]/g, '-')
  return `${PICSUM_BASE}/${safeSeed}/${width}/${height}`
}

/** 距离现在 N 天前的 ISO 时间（让截图里的日期看起来是新鲜的） */
function daysAgo(days: number, hour = 21, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** 在某个 ISO 时间之后再过 N 小时 */
function hoursAfter(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3600_000).toISOString()
}

/** 距离现在 N 小时前（通知列表用相对时间展示） */
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString()
}

/** 距离现在 N 分钟前 */
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

function avatarPicture(seed: string): { picture: ImageUrls } {
  return { picture: createImageUrls(seed, 512) }
}

// ---------------------------------------------------------------------------
// 用户
// ---------------------------------------------------------------------------

function makeUser(opts: {
  uid: string
  nickname: string
  seed: string
  bio?: string
  gender?: 'MALE' | 'FEMALE'
  ipLoc?: string
  relation?: 'STRANGE' | 'FOLLOWING'
}): UserBasic {
  return {
    type: 'USER',
    uid: opts.uid,
    avatar: avatarPicture(opts.seed),
    nickname: opts.nickname,
    isNicknameSet: true,
    ...(opts.bio ? { bio: opts.bio } : {}),
    ...(opts.gender ? { gender: opts.gender } : {}),
    isCancelled: false,
    readTrackInfo: {},
    ipLoc: opts.ipLoc,
    relation: opts.relation ?? 'STRANGE',
    isBlockedByViewer: false,
  }
}

/** 主播 / 作者 */
const podcasters: UserBasic[] = [
  makeUser({ uid: 'u-001', nickname: '陈默', seed: 'host-chenmo', bio: '写作者，夜晚的潜水艇主播', gender: 'MALE', ipLoc: '上海', relation: 'FOLLOWING' }),
  makeUser({ uid: 'u-002', nickname: '阿桃', seed: 'host-atao', bio: '自由编辑，喜欢在深夜录音', gender: 'FEMALE', ipLoc: '杭州', relation: 'FOLLOWING' }),
  makeUser({ uid: 'u-003', nickname: '苏晚', seed: 'host-suwan', bio: '心理咨询师 / 忽明忽暗主播', gender: 'FEMALE', ipLoc: '北京', relation: 'FOLLOWING' }),
  makeUser({ uid: 'u-004', nickname: '老周', seed: 'host-laozhou', bio: '前大厂工程师，现独立开发者', gender: 'MALE', ipLoc: '深圳', relation: 'FOLLOWING' }),
  makeUser({ uid: 'u-005', nickname: '小满', seed: 'host-xiaoman', bio: '美食编辑，吃遍街边小馆', gender: 'FEMALE', ipLoc: '成都', relation: 'FOLLOWING' }),
  makeUser({ uid: 'u-006', nickname: '林一', seed: 'host-linyi', bio: '书店店长，逆流书房主播', gender: 'MALE', ipLoc: '南京', relation: 'FOLLOWING' }),
  makeUser({ uid: 'u-007', nickname: '阿壮', seed: 'host-azhuang', bio: '城市观察者，凌晨还在街上', gender: 'MALE', ipLoc: '广州', relation: 'FOLLOWING' }),
  makeUser({ uid: 'u-008', nickname: '大熊', seed: 'host-daxiong', bio: '商业记者，硬核充电站主播', gender: 'MALE', ipLoc: '北京', relation: 'FOLLOWING' }),
  makeUser({ uid: 'u-009', nickname: '张野', seed: 'host-zhangye', bio: '影评人，电影节常客', gender: 'MALE', ipLoc: '上海', relation: 'FOLLOWING' }),
  makeUser({ uid: 'u-010', nickname: '姜川', seed: 'host-jiangchuan', bio: '户外向导，山与海之间主播', gender: 'MALE', ipLoc: '大理', relation: 'FOLLOWING' }),
  makeUser({ uid: 'u-011', nickname: '老李', seed: 'host-laoli', bio: '声音设计师 / 声音制造局主播', gender: 'MALE', ipLoc: '北京', relation: 'FOLLOWING' }),
  makeUser({ uid: 'u-012', nickname: '小北', seed: 'host-xiaobei', bio: '独立音乐人 / 声音制造局主播', gender: 'FEMALE', ipLoc: '北京', relation: 'FOLLOWING' }),
  // 普通听众（评论区、搜索结果里的用户）
  makeUser({ uid: 'u-020', nickname: '晚风', seed: 'listener-wanfeng', bio: '夜里听播客的人，偶尔写点东西', gender: 'FEMALE', ipLoc: '上海' }),
  makeUser({ uid: 'u-021', nickname: '阿柑', seed: 'listener-agan', bio: '通勤四十分钟，播客是最好的搭子', gender: 'MALE', ipLoc: '杭州' }),
  makeUser({ uid: 'u-022', nickname: '芒果汁', seed: 'listener-mangguo', bio: '心理学爱好者，正在自我修复中', gender: 'FEMALE', ipLoc: '成都' }),
  makeUser({ uid: 'u-023', nickname: '山雀', seed: 'listener-shanque', bio: '摄影 / 旅行 / 手冲咖啡', ipLoc: '厦门' }),
  makeUser({ uid: 'u-024', nickname: '河马先生', seed: 'listener-hema', bio: '产品经理，独立播客重度用户', gender: 'MALE', ipLoc: '深圳' }),
  makeUser({ uid: 'u-025', nickname: '纸片人', seed: 'listener-zhipianren', bio: '只看旧电影，只读旧书', ipLoc: '西安' }),
  makeUser({ uid: 'u-026', nickname: '海盐汽水', seed: 'listener-haiyan', bio: '大四在读，准备去很远的地方', ipLoc: '武汉' }),
]

export const allUsers: UserBasic[] = podcasters

const usersByUid: Record<string, UserBasic> = Object.fromEntries(
  allUsers.map((user) => [user.uid, user]),
)

/** 当前登录用户（mock 登录 / profile 端点返回的这个人） */
export const mockProfile: UserProfile = {
  type: 'USER',
  uid: 'u-020',
  nickname: '晚风',
  isNicknameSet: true,
  avatar: avatarPicture('profile-wanfeng'),
  bio: '夜里听播客的人，偶尔写点东西。把白天没说完的话，留给耳机。',
  gender: 'FEMALE',
  isCancelled: false,
  ipLoc: '上海',
  birthYear: 1994,
  industry: '设计 / 内容',
  certifications: [{ kind: 'PODCASTER', shows: [{ title: '夜晚的潜水艇' }] }],
  createdAt: daysAgo(820),
  phoneNumber: { mobilePhoneNumber: '138****8000', areaCode: '+86' },
  isInvited: true,
}

/** 评论区的「我」 */
const me = usersByUid['u-020']
const listeners: UserBasic[] = [
  usersByUid['u-021'],
  usersByUid['u-022'],
  usersByUid['u-023'],
  usersByUid['u-024'],
  usersByUid['u-025'],
  usersByUid['u-026'],
  me,
]

// ---------------------------------------------------------------------------
// 播客
// ---------------------------------------------------------------------------

const PODCAST_COLORS = [
  { original: '#FF7A45', light: '#FFC069', dark: '#AD2102' },
  { original: '#36CFC9', light: '#87E8DE', dark: '#00474F' },
  { original: '#597EF7', light: '#ADC6FF', dark: '#10239E' },
  { original: '#9254DE', light: '#D3ADF7', dark: '#391085' },
  { original: '#73D13D', light: '#B7EB8F', dark: '#135200' },
  { original: '#F759AB', light: '#FFADD2', dark: '#9E1068' },
  { original: '#FFC53D', light: '#FFE58F', dark: '#874D00' },
  { original: '#40A9FF', light: '#91D5FF', dark: '#003EB3' },
  { original: '#FF9C6E', light: '#FFD8BF', dark: '#AD4E00' },
  { original: '#13C2C2', light: '#87E8DE', dark: '#00474F' },
]

interface PodcastSeed {
  pid: string
  title: string
  author: string
  brief: string
  description: string
  seed: string
  subscriptionCount: number
  episodeCount: number
  topicLabels: string[]
  podcasterUids: string[]
  categoryId: string
  latestDaysAgo: number
  subscriptionStar?: boolean
  subscriptionStatus?: 'ON' | 'OFF'
}

const podcastSeeds: PodcastSeed[] = [
  {
    pid: 'mock-pid',
    title: '夜晚的潜水艇',
    author: '陈默 & 阿桃',
    brief: '在夜里，把白天没说完的话说完。',
    description:
      '「夜晚的潜水艇」是一档在深夜更新的泛文化播客。\n\n我们聊写作、城市、亲密关系，也聊那些看起来没什么用的私人感受。主播陈默是写作者，阿桃是自由编辑，两个人常常在凌晨两点把录音键按下，然后忘掉时间。\n\n这里没有嘉宾提问清单，只有一杯热茶和一段可以慢慢听完的对话。如果你也习惯在夜里醒着，欢迎上艇。',
    seed: 'night-submarine',
    subscriptionCount: 12876,
    episodeCount: 128,
    topicLabels: ['夜晚', '城市', '写作', '生活'],
    podcasterUids: ['u-001', 'u-002'],
    categoryId: 'cat-arts',
    latestDaysAgo: 2,
    subscriptionStar: true,
  },
  {
    pid: 'pod-002',
    title: '忽明忽暗',
    author: '苏晚',
    brief: '聊聊情绪的来路和去处。',
    description:
      '一档关于情绪、心理与自我成长的对谈节目。\n\n主播苏晚是一名心理咨询师，她相信情绪没有对错，只有来路。每期节目我们围绕一个具体的情绪现场展开：它从哪里来，在哪里被卡住，又可以怎样被安放。\n\n不提供速效答案，只陪你多待一会儿。',
    seed: 'flicker-emotion',
    subscriptionCount: 8432,
    episodeCount: 22,
    topicLabels: ['心理', '情绪', '成长'],
    podcasterUids: ['u-003'],
    categoryId: 'cat-psych',
    latestDaysAgo: 5,
    subscriptionStar: true,
  },
  {
    pid: 'pod-003',
    title: '键盘之外',
    author: '老周',
    brief: '技术之外，聊聊人和工具。',
    description:
      '「键盘之外」关注技术如何进入普通人的生活。\n\n老周做了十年程序员，现在是一名独立开发者。他不喜欢把技术讲得高深莫测，更愿意聊聊代码之外的东西：开源社区里的人情往来、从业者的焦虑、工具如何改变了我们的时间感。',
    seed: 'beyond-keyboard',
    subscriptionCount: 15620,
    episodeCount: 57,
    topicLabels: ['科技', '互联网', 'AI', '职场'],
    podcasterUids: ['u-004'],
    categoryId: 'cat-tech',
    latestDaysAgo: 3,
  },
  {
    pid: 'pod-004',
    title: '一勺盐',
    author: '小满',
    brief: '一档关于食物和人的播客。',
    description:
      '食物是最日常的文化现场。\n\n「一勺盐」探访菜市场、早餐摊、深夜厨房和家庭餐桌，听摊主、厨子、食客讲他们和食物的故事。主播小满相信，一勺盐的多少里，藏着一座城市的脾气。',
    seed: 'a-spoon-of-salt',
    subscriptionCount: 6320,
    episodeCount: 90,
    topicLabels: ['美食', '人文', '城市'],
    podcasterUids: ['u-005'],
    categoryId: 'cat-food',
    latestDaysAgo: 6,
  },
  {
    pid: 'pod-005',
    title: '逆流书房',
    author: '林一',
    brief: '在书店打烊之后，继续读书。',
    description:
      '「逆流书房」是一档慢慢读、慢慢聊的读书节目。\n\n主播林一经营一家小书店，节目通常在打烊之后录制。我们重读经典，也聊那些被低估的小书；不追热点，只关心一本书能不能在某个具体的夜晚陪到你。',
    seed: 'upstream-library',
    subscriptionCount: 4210,
    episodeCount: 43,
    topicLabels: ['读书', '文学', '访谈'],
    podcasterUids: ['u-006'],
    categoryId: 'cat-book',
    latestDaysAgo: 4,
  },
  {
    pid: 'pod-006',
    title: '凌晨四点的便利店',
    author: '阿壮',
    brief: '城市睡着时，我们在街角。',
    description:
      '城市在凌晨四点会露出另一张脸。\n\n主播阿壮是一名城市观察者，他习惯在夜里出门，和夜班司机、便利店店员、早市摊主聊天。这档节目记录那些白天不易被看见的人和生活，也记录一座城市在黑暗里的呼吸。',
    seed: '4am-store',
    subscriptionCount: 9870,
    episodeCount: 31,
    topicLabels: ['城市', '观察', '人文'],
    podcasterUids: ['u-007'],
    categoryId: 'cat-life',
    latestDaysAgo: 1,
  },
  {
    pid: 'pod-007',
    title: '硬核充电站',
    author: '大熊',
    brief: '给打工人充电的商业硬货。',
    description:
      '「硬核充电站」用商业视角拆解职场与行业。\n\n主播大熊是一名商业记者，每期邀请一位从业者聊具体的事：一份商业计划书是怎么死的、一次升职背后的博弈、副业到底能不能救命。没有空话，只有案例和复盘。',
    seed: 'hardcore-charge',
    subscriptionCount: 21050,
    episodeCount: 52,
    topicLabels: ['商业', '职场', '创业'],
    podcasterUids: ['u-008'],
    categoryId: 'cat-biz',
    latestDaysAgo: 4,
  },
  {
    pid: 'pod-008',
    title: '电影的第二种看法',
    author: '张野',
    brief: '重看那些被时间筛过的电影。',
    description:
      '同一部电影，第二次看总有不同的感受。\n\n「电影的第二种看法」是一档影评节目。主播张野不追新片热度，更愿意重看那些被时间筛过的电影，结合拍摄幕后、时代背景和个人记忆，聊聊电影怎样改变了我们看世界的方式。',
    seed: 'second-take-cinema',
    subscriptionCount: 7340,
    episodeCount: 73,
    topicLabels: ['影视', '影评', '经典'],
    podcasterUids: ['u-009'],
    categoryId: 'cat-movie',
    latestDaysAgo: 7,
  },
  {
    pid: 'pod-009',
    title: '山与海之间',
    author: '姜川',
    brief: '把脚步放慢，去山里去海边。',
    description:
      '「山与海之间」是一档旅行与户外节目。\n\n主播姜川做了八年户外向导，走过高原、雨林和海岸线。节目里有徒步攻略，也有路上的狼狈与风景；更重要的是聊聊，人在自然里为什么会重新变得诚实。',
    seed: 'mountains-and-seas',
    subscriptionCount: 5120,
    episodeCount: 40,
    topicLabels: ['旅行', '户外', '自然'],
    podcasterUids: ['u-010'],
    categoryId: 'cat-travel',
    latestDaysAgo: 9,
  },
  {
    pid: 'pod-010',
    title: '声音制造局',
    author: '老李 & 小北',
    brief: '拆解一首歌诞生的全过程。',
    description:
      '一首歌是怎么被做出来的？\n\n「声音制造局」邀请音乐人、制作人、乐手聊创作现场：一次采样的来路、一段编曲的取舍、一场演出的意外。主播老李是声音设计师，小北是独立音乐人，两个人一个讲技术，一个讲感受。',
    seed: 'sound-factory',
    subscriptionCount: 11230,
    episodeCount: 28,
    topicLabels: ['音乐', '民谣', '制作'],
    podcasterUids: ['u-011', 'u-012'],
    categoryId: 'cat-music',
    latestDaysAgo: 5,
    subscriptionStar: true,
  },
]

function makePodcast(seed: PodcastSeed, index: number): PodcastBasic {
  return {
    type: 'PODCAST',
    pid: seed.pid,
    title: seed.title,
    author: seed.author,
    brief: seed.brief,
    description: seed.description,
    subscriptionCount: seed.subscriptionCount,
    image: createImageUrls(`podcast-${seed.seed}`, 1024),
    color: PODCAST_COLORS[index % PODCAST_COLORS.length],
    topicLabels: seed.topicLabels,
    syncMode: 'CLOUD',
    episodeCount: seed.episodeCount,
    latestEpisodePubDate: daysAgo(seed.latestDaysAgo, 18, 30),
    subscriptionStatus: seed.subscriptionStatus ?? 'ON',
    subscriptionPush: true,
    subscriptionPushPriority: 'MEDIUM',
    subscriptionStar: seed.subscriptionStar ?? false,
    status: 'NORMAL',
    permissions: [
      { name: 'SHARE', status: 'ENABLE' },
      { name: 'COMMENT', status: 'ENABLE' },
    ],
    payType: 'FREE',
    payEpisodeCount: 0,
    podcasters: seed.podcasterUids.map((uid) => usersByUid[uid]),
    readTrackInfo: {},
    hasPopularEpisodes: true,
    contacts: [
      { type: 'WECHAT', name: `公众号：${seed.title}`, note: '商务合作请备注' },
      { type: 'WEIBO', name: `@${seed.author}`, url: 'https://weibo.com' },
    ],
    isCustomized: false,
    playTime: 3600,
    showZhuiguangIcon: true,
  }
}

/** 全部播客（顺序即首页 / 订阅页展示顺序） */
export const podcasts: PodcastBasic[] = podcastSeeds.map(makePodcast)

export const podcastsByPid: Record<string, PodcastBasic> = Object.fromEntries(
  podcasts.map((podcast) => [podcast.pid, podcast]),
)

/** 相关播客（按订阅数相近度挑 4 个） */
export const podcastRelated: Record<string, PodcastRelatedItem[]> = Object.fromEntries(
  podcasts.map((podcast) => {
    const candidates = podcasts
      .filter((item) => item.pid !== podcast.pid)
      .sort(
        (a, b) =>
          Math.abs(a.subscriptionCount - podcast.subscriptionCount) -
          Math.abs(b.subscriptionCount - podcast.subscriptionCount),
      )
      .slice(0, 4)
    return [podcast.pid, candidates.map((item) => ({ podcast: item }))]
  }),
)

// ---------------------------------------------------------------------------
// 单集
// ---------------------------------------------------------------------------

const SAMPLE_CHAPTERS: string[][] = [
  ['00:00 开场：今天想聊的这件事', '07:20 一个具体的生活现场', '18:00 我们各自的答案', '31:40 把问题拆开看', '45:10 给听众的一点建议', '56:30 尾声与下期预告'],
  ['00:00 近期生活汇报', '06:10 从一条留言说起', '15:30 那些说不出口的部分', '27:00 换个角度重新理解', '38:20 如果只能给一个建议', '49:40 下期预告'],
  ['00:00 寒暄与天气', '05:40 本期主题缘起', '14:20 三件小事', '25:30 一段来信', '36:00 我们踩过的坑', '47:20 片尾曲与告别'],
]

/** 为普通单集生成一段像样的 shownotes 富文本（会被 DOMPurify 白名单过滤） */
function buildShownotes(podcast: PodcastBasic, title: string, index: number): string {
  const chapters = SAMPLE_CHAPTERS[index % SAMPLE_CHAPTERS.length]
  const lines = chapters.map((item) => `<li>${item}</li>`).join('\n')
  return [
    `<p><strong>本期节目：</strong>${title}</p>`,
    `<p>${podcast.brief}「${podcast.title}」的第 ${120 - index * 2} 期节目，我们想聊聊一个被反复提起、却很少被认真讨论的话题。</p>`,
    `<p><strong>时间轴</strong></p>`,
    `<ul>`,
    lines,
    `</ul>`,
    `<p><strong>关于主播</strong></p>`,
    `<p>${podcast.author}，${podcast.brief}如果你喜欢这期节目，欢迎在小宇宙订阅「${podcast.title}」，也欢迎在评论区留下你的想法。</p>`,
    `<p>商务合作 / 听众来信：hello@mock-podcast.cn</p>`,
  ].join('\n')
}

/** 主打单集（/episode/mock-eid）的完整富文本 shownotes */
const FEATURED_SHOWNOTES = `
<h3>深夜写作的人，都在和什么对话？</h3>
<p>凌晨两点，城市终于安静下来。有人已经睡熟，有人刚打开文档。这一期，我们和写作者林一一起聊了聊「深夜写作」这件事——那些没有发出去的草稿、写到一半被删掉的段落、以及写字时真正在对话的那个人。</p>
<p><strong>本期主播：</strong>陈默、阿桃<br /><strong>本期嘉宾：</strong>林一（书店店长、<em>逆流书房</em>主播）</p>
<h3>时间轴</h3>
<ul>
<li>00:00 开场：为什么偏偏是深夜</li>
<li>08:20 那些没有发出去的草稿</li>
<li>17:40 写作是一种自我整理</li>
<li>27:30 一封让主播泪目的听众来信</li>
<li>36:10 给听众的三个写作练习</li>
<li>48:50 尾声：把句子留给明天</li>
</ul>
<h3>本期提到</h3>
<p>书籍：《夜晚的潜水艇》《我的阿勒泰》《一个自己的房间》<br />电影：《海边的曼彻斯特》《烧纸》</p>
<blockquote>“写作不是为了被理解，而是为了理解自己。”</blockquote>
<p><strong>片尾音乐：</strong>Mock Sessions – Nocturne（已获授权）</p>
<p>听众来信请寄：<a href="mailto:hello@mock-podcast.cn" target="_blank" rel="noreferrer noopener">hello@mock-podcast.cn</a></p>
`.trim()

interface EpisodeSeed {
  pid: string
  title: string
  description: string
  /** 生成 shownotes 时用的序号 */
  index: number
}

const EPISODE_TABLE: Record<string, EpisodeSeed[]> = {
  'mock-pid': [
    { pid: 'mock-pid', index: 0, title: 'Vol.128 深夜写作的人，都在和什么对话？', description: '和林一聊深夜写作：那些没发出去的草稿，和写字时真正在对话的人。' },
    { pid: 'mock-pid', index: 1, title: 'Vol.127 我们为什么需要一间只属于自己的房间', description: '从一间房间聊到独处的权利：空间如何塑造一个人的精神生活。' },
    { pid: 'mock-pid', index: 2, title: 'Vol.126 从一份早餐开始的迁徙', description: '早餐摊主、搬家、异乡的清晨——普通人的迁徙史藏在细小的生活里。' },
    { pid: 'mock-pid', index: 3, title: 'Vol.125 一个普通人的四十次搬家', description: '我们请来一位搬了四十次家的听众，聊聊他的行李和舍弃。' },
    { pid: 'mock-pid', index: 4, title: 'Vol.124 把生活过成一首未完成的诗', description: '写诗的人并不神秘，他们只是更愿意停下来描述此刻。' },
    { pid: 'mock-pid', index: 5, title: 'Vol.123 和失眠相处的一百种方法', description: '睡不着的时候，我们都在想些什么？一份不保证有效的失眠指南。' },
    { pid: 'mock-pid', index: 6, title: 'Vol.122 城市里的第三种时间', description: '除了打卡时间和睡眠时间，城市里还有没有属于自己的一小块时间？' },
    { pid: 'mock-pid', index: 7, title: 'Vol.121 关于告别，我们没说出口的部分', description: '有些告别发生在很久以后，才在某个深夜被听见。' },
    { pid: 'mock-pid', index: 8, title: 'Vol.120 冬日书单：在寒冷里读温暖的书', description: '七本适合冬天的书，和一杯热红酒的阅读顺序。' },
    { pid: 'mock-pid', index: 9, title: 'Vol.119 一个人的深夜食堂', description: '一个人吃饭并不等于孤独，它有时候是自由的味道。' },
  ],
  'pod-002': [
    { pid: 'pod-002', index: 0, title: '022 情绪没有对错，只有来路', description: '愤怒、羞耻、委屈，它们从哪里来，又想告诉我们什么。' },
    { pid: 'pod-002', index: 1, title: '021 高敏感人群的自救指南', description: '当感知力成为负担，如何给自己搭一层缓冲垫。' },
    { pid: 'pod-002', index: 2, title: '020 如何停止和自己打架', description: '内耗的本质，是两套评价系统在同一具身体里争吵。' },
    { pid: 'pod-002', index: 3, title: '019 亲密关系里的隐形劳动', description: '谁在记住纪念日，谁在承担情绪的收尾工作？' },
    { pid: 'pod-002', index: 4, title: '018 把焦虑说出口之后', description: '表达焦虑并不会让你更焦虑，前提是找到对的人。' },
    { pid: 'pod-002', index: 5, title: '017 一个心理咨询师的自我怀疑', description: '苏晚聊她最想放弃的那个时刻，以及为什么留了下来。' },
    { pid: 'pod-002', index: 6, title: '016 允许自己一事无成', description: '在效率至上的时代，闲下来为什么会让人内疚。' },
    { pid: 'pod-002', index: 7, title: '015 原生家庭的回声', description: '我们带着哪些未被回答的问题，长成了大人。' },
  ],
  'pod-003': [
    { pid: 'pod-003', index: 0, title: 'Ep.56 AI 时代，普通人的手艺还值钱吗', description: '当工具越来越聪明，人的判断力、审美和经验还有多重要。' },
    { pid: 'pod-003', index: 1, title: 'Ep.55 从一个开源项目看社区的力量', description: '一个没有工资的项目，为什么能持续十年。' },
    { pid: 'pod-003', index: 2, title: 'Ep.54 效率工具到底解放了谁', description: '我们节省下来的时间，最后去了哪里。' },
    { pid: 'pod-003', index: 3, title: 'Ep.53 程序员的第二职业曲线', description: '写代码之外，三十岁以后还能做什么。' },
    { pid: 'pod-003', index: 4, title: 'Ep.52 我们被算法驯化的十年', description: '从信息流到推荐系统，注意力是如何被重新分配的。' },
    { pid: 'pod-003', index: 5, title: 'Ep.51 远程办公三年后的真相', description: '效率、孤独和那些回不去的办公室日常。' },
    { pid: 'pod-003', index: 6, title: 'Ep.50 硬件创业者的孤注一掷', description: '一个做出原型机的人，讲他抵押房子的那一年。' },
  ],
  'pod-004': [
    { pid: 'pod-004', index: 0, title: '090 一碗面里的地方志', description: '从一碗牛肉面出发，聊聊一座城市的移民和口味。' },
    { pid: 'pod-004', index: 1, title: '089 菜市场是城市的客厅', description: '菜市场的清晨，是一座城市最诚实的地方。' },
    { pid: 'pod-004', index: 2, title: '088 关于发酵的漫长等待', description: '酱、酒、酸菜，时间是如何参与味道的。' },
    { pid: 'pod-004', index: 3, title: '087 早餐摊主的一天', description: '凌晨三点起床的人，撑起了整座城市的早晨。' },
    { pid: 'pod-004', index: 4, title: '086 在厨房里和自己和解', description: '做饭这件小事，如何成为成年人的心理治疗。' },
    { pid: 'pod-004', index: 5, title: '085 川菜的另一半江湖', description: '不止麻辣：被误解的川菜味型谱系。' },
    { pid: 'pod-004', index: 6, title: '084 食物里的乡愁与迁徙', description: '一道家乡菜，能带一个人走多远。' },
  ],
  'pod-005': [
    { pid: 'pod-005', index: 0, title: 'Vol.42 重读《百年孤独》', description: '二十岁读和三十岁读，马孔多的雨声完全不同。' },
    { pid: 'pod-005', index: 1, title: 'Vol.41 为什么我们还需要纸质书', description: '书页、重量和批注，纸书提供的是一种关系。' },
    { pid: 'pod-005', index: 2, title: 'Vol.40 与一本旧书重逢', description: '书店打烊后，林一讲一本被读者退回来的旧书。' },
    { pid: 'pod-005', index: 3, title: 'Vol.39 阅读是随身携带的避难所', description: '在生活的缝隙里，读书如何提供短暂的撤退。' },
    { pid: 'pod-005', index: 4, title: 'Vol.38 从书店打烊后开始的对话', description: '深夜的书店、留到最后的读者，和一场没有准备的聊天。' },
    { pid: 'pod-005', index: 5, title: 'Vol.37 一份不着急读完的书单', description: '七本可以放在床头慢慢读的书。' },
  ],
  'pod-006': [
    { pid: 'pod-006', index: 0, title: '031 夜班司机的城市地图', description: '凌晨的街道属于另一种人，他们记得每个路口的光。' },
    { pid: 'pod-006', index: 1, title: '030 便利店灯光下的陌生人', description: '关东煮的热气里，藏着很多没说出口的故事。' },
    { pid: 'pod-006', index: 2, title: '029 凌晨菜市场的第一批人', description: '当城市还在睡，市场已经醒来三个小时了。' },
    { pid: 'pod-006', index: 3, title: '028 城市缝隙里的修理铺', description: '修鞋、修表、修收音机：一门正在消失的手艺。' },
    { pid: 'pod-006', index: 4, title: '027 一段被拆迁的街道记忆', description: '在推土机到来之前，我们录下了这条街的声音。' },
    { pid: 'pod-006', index: 5, title: '026 外卖骑手的午间两小时', description: '一趟配送背后，是一张精确到分钟的时间表。' },
  ],
  'pod-007': [
    { pid: 'pod-007', index: 0, title: '052 打工人的存量时代', description: '当增长不再是默认选项，个人如何重新做选择。' },
    { pid: 'pod-007', index: 1, title: '051 一个创业者的失败复盘', description: '烧完最后一笔钱之后，他复盘了七个错误。' },
    { pid: 'pod-007', index: 2, title: '050 从实习生到合伙人', description: '一家公司内部的成长路径与那些没写进 JD 的能力。' },
    { pid: 'pod-007', index: 3, title: '049 副业是解药还是安慰剂', description: '副业的收入曲线、时间成本和心理账本。' },
    { pid: 'pod-007', index: 4, title: '048 聊聊职场里那些隐形规则', description: '会议里的座位、邮件里的抄送、和沉默的权力。' },
    { pid: 'pod-007', index: 5, title: '047 35 岁焦虑的本质', description: '被反复讨论的年龄焦虑，究竟是哪几种焦虑叠在一起。' },
  ],
  'pod-008': [
    { pid: 'pod-008', index: 0, title: '073 重看《花样年华》的四个瞬间', description: '走廊、雨、旗袍和那一段没说出口的感情。' },
    { pid: 'pod-008', index: 1, title: '072 那些被低估的国产片', description: '五部当年票房一般、如今越看越好的电影。' },
    { pid: 'pod-008', index: 2, title: '071 恐怖片为什么让人着迷', description: '恐惧是一种安全的冒险，也是一种古老的叙事引擎。' },
    { pid: 'pod-008', index: 3, title: '070 一个影迷的电影节记忆', description: '在黑暗里连看六场的日子，和散场后的凌晨。' },
    { pid: 'pod-008', index: 4, title: '069 从剪辑台到观众席', description: '剪辑师如何决定一场戏的呼吸。' },
    { pid: 'pod-008', index: 5, title: '068 电影里的城市漫游', description: '那些让城市成为主角的电影，和它们的街道。' },
  ],
  'pod-009': [
    { pid: 'pod-009', index: 0, title: '040 徒步冰岛：在风里行走', description: '十一月的冰岛，风速、路线、和一个人的沉默。' },
    { pid: 'pod-009', index: 1, title: '039 一个人去海边', description: '独自看海的六个小时，以及带回来的三句话。' },
    { pid: 'pod-009', index: 2, title: '038 高原上的睡眠', description: '海拔四千米的夜里，身体和星空一起失眠。' },
    { pid: 'pod-009', index: 3, title: '037 旅行的意义被高估了吗', description: '逃跑、寻找、验证：我们出发的真实动机。' },
    { pid: 'pod-009', index: 4, title: '036 背包里的二十件物品', description: '一个长期在路上的人的行李清单。' },
    { pid: 'pod-009', index: 5, title: '035 在雨季遇见吴哥', description: '雨林、石头和一千年前留下的微笑。' },
  ],
  'pod-010': [
    { pid: 'pod-010', index: 0, title: '028 一首歌的诞生需要多久', description: '从 demo 到母带，一首歌经历的十二个工序。' },
    { pid: 'pod-010', index: 1, title: '027 华语民谣的三次浪潮', description: '三个年代的民谣，三种不同的表达方式。' },
    { pid: 'pod-010', index: 2, title: '026 采样、母带与那些细节', description: '一秒钟的声音里，藏着多少道技术选择。' },
    { pid: 'pod-010', index: 3, title: '025 乐手的地下室', description: '排练室里的烟味、泡面和第一次合练的兴奋。' },
    { pid: 'pod-010', index: 4, title: '024 我们为什么迷恋现场', description: '现场演出提供的是录音无法复制的什么东西。' },
    { pid: 'pod-010', index: 5, title: '023 耳机里的私人宇宙', description: '每个人都有自己的私人歌单，那是一段编好的心情。' },
  ],
}

const FAVORITE_EIDS = new Set([
  'mock-eid',
  'mock-pid-ep-3',
  'pod-002-ep-2',
  'pod-004-ep-1',
  'pod-006-ep-1',
  'pod-008-ep-2',
  'pod-005-ep-3',
  'pod-010-ep-2',
])

function makeEpisode(seed: EpisodeSeed, podcastIndex: number): EpisodeBasic {
  const podcast = podcastsByPid[seed.pid]
  const episodeNumber = seed.index + 1
  const eid =
    seed.pid === 'mock-pid' && seed.index === 0
      ? 'mock-eid'
      : `${seed.pid}-ep-${episodeNumber}`
  const isFeatured = eid === 'mock-eid'
  const days = 2 + seed.index * 7 + podcastIndex
  const shownotes = isFeatured
    ? FEATURED_SHOWNOTES
    : buildShownotes(podcast, seed.title, seed.index)
  const duration = isFeatured
    ? 5400
    : 2940 + ((seed.index * 137 + podcastIndex * 211) % 55) * 60
  const playCount = isFeatured
    ? 24680
    : 3200 + ((seed.index * 733 + podcastIndex * 977) % 12000)
  const clapCount = isFeatured
    ? 486
    : 40 + ((seed.index * 37 + podcastIndex * 19) % 260)
  const favoriteCount = isFeatured
    ? 1280
    : 60 + ((seed.index * 53 + podcastIndex * 29) % 700)
  const commentCount = isFeatured
    ? 10
    : 4 + ((seed.index + podcastIndex) % 3)

  return {
    type: 'EPISODE',
    eid,
    pid: seed.pid,
    title: seed.title,
    description: seed.description,
    shownotes,
    image: createImageUrls(`episode-${eid}`, 1024),
    enclosure: { url: SAMPLE_AUDIO_URL },
    isPrivateMedia: false,
    mediaKey: `mock-media-${eid}`,
    media: {
      id: `mock-media-${eid}`,
      size: duration * 24_000,
      mimeType: 'audio/mpeg',
      source: { mode: 'PUBLIC', url: SAMPLE_AUDIO_URL },
    },
    clapCount,
    commentCount,
    playCount,
    favoriteCount,
    pubDate: daysAgo(days, 18, 30),
    status: 'NORMAL',
    duration,
    podcast,
    isPlayed: seed.index > 3,
    isFinished: seed.index > 4,
    isPicked: seed.index < 2 || isFeatured,
    isFavorited: FAVORITE_EIDS.has(eid),
    permissions: [
      { name: 'SHARE', status: 'ENABLE' },
      { name: 'COMMENT', status: 'ENABLE' },
    ],
    payType: 'FREE',
    labels: [
      { name: '播客', code: 'PODCAST' },
      { name: podcast.topicLabels[0] ?? '生活', code: 'TOPIC' },
    ],
    sponsors: [],
    isCustomized: false,
    ipLoc: '上海',
  }
}

/** 每个播客的单集列表（按发布时间倒序，第一页 8 条，第二页剩余） */
export const episodesByPid: Record<string, EpisodeBasic[]> = Object.fromEntries(
  podcastSeeds.map((seed, podcastIndex) => [
    seed.pid,
    (EPISODE_TABLE[seed.pid] ?? []).map((episode) => makeEpisode(episode, podcastIndex)),
  ]),
)

/** 全部单集（扁平的，供榜单 / 搜索使用） */
export const episodes: EpisodeBasic[] = Object.values(episodesByPid).flat()

export const episodesByEid: Record<string, EpisodeBasic> = Object.fromEntries(
  episodes.map((episode) => [episode.eid, episode]),
)

/** 每张单集的详情（EpisodeDetail = EpisodeBasic + transcript 等附加字段） */
export const episodeDetails: Record<string, EpisodeDetail> = Object.fromEntries(
  episodes.map((episode) => [
    episode.eid,
    {
      ...episode,
      transcript: { mediaId: `mock-transcript-${episode.eid}` },
      transcriptMediaId: `mock-transcript-${episode.eid}`,
      listedInEditorPickAt: [daysAgo(2), daysAgo(4)],
      wechatShare: { style: 'DEFAULT' },
    } satisfies EpisodeDetail,
  ]),
)

// ---------------------------------------------------------------------------
// AI 摘要 / 文字稿（真实抓包 2026-11-11）
// ---------------------------------------------------------------------------

/** 单集 AI 摘要（/ai_summary_episode_retrieve_brief）：真实响应外层还有 requested/confirmation */
export const episodeAISummaries: Record<string, { status: 'ready'; brief: string }> = {
  'mock-eid': {
    status: 'ready',
    brief:
      '这期请到两位写作者聊「深夜写作」：为什么偏偏是凌晨、那些没发出去的草稿，以及写作如何帮人理解自己。适合通勤或睡前收听。',
  },
}

/** 单集文字稿元数据（/episode_transcript_get）：正文在 CDN，由后端 /episode_transcript_content 代理 */
export const episodeTranscripts: Record<
  string,
  { key: string; vendorDeclaration: string; transcriptUrl: string; highlightUrl: string }
> = {
  'mock-eid': {
    key: 'mock-transcript-key:1',
    vendorDeclaration: '文字稿由小宇宙自动生成（Mock）',
    transcriptUrl: 'https://transcript.xyzcdn.net/mock/mock-eid',
    highlightUrl: 'https://transcript-highlight.xyzcdn.net/mock/mock-eid',
  },
}

/** 文字稿正文（真实 CDN JSON 是 `[{text, startMs}]`） */
export const mockTranscriptSegments: { text: string; startMs: number }[] = [
  { text: '凌晨两点，城市终于安静下来。有人已经睡着，有人刚打开文档。', startMs: 0 },
  { text: '这一期，我们和两位写作者聊了聊「深夜写作」这件事。', startMs: 18000 },
  { text: '为什么偏偏是凌晨？因为那是最不容易被打断的一段时间。', startMs: 45000 },
  { text: '那些没有发出去的草稿，其实也在帮我们理解自己。', startMs: 78000 },
  { text: '写作不是为了被理解，而是为了理解自己。', startMs: 132000 },
  { text: '把句子留给明天，也是一种温柔的结束方式。', startMs: 176000 },
]

// ---------------------------------------------------------------------------
// 评论
// ---------------------------------------------------------------------------

const GENERIC_COMMENT_TEXTS = [
  '这期节目太治愈了，通勤路上听完心情都变好了。',
  '主播的声音很有辨识度，一开口世界就安静下来了。',
  '27:30 那一段我反复听了三遍，说到心坎里。',
  '听完立刻去下单了嘉宾提到的那本书。',
  '每期都在等更新，这档播客已经成了我的睡前仪式。',
  '这期嘉宾的表达好真诚，学到了很多。',
  '唯一的问题是每次都听不够，希望节目再长一点。',
  '在加班的深夜听到这期，忽然觉得没那么孤单了。',
]

function makeComment(opts: {
  id: string
  eid: string
  author: UserBasic
  text: string
  createdAt: string
  likeCount?: number
  liked?: boolean
  collected?: boolean
  pinned?: boolean
  threadReplyCount?: number
  level?: number
  thread?: string
  authorAssociation?: string
}): Comment {
  return {
    id: opts.id,
    type: 'COMMENT',
    owner: { id: opts.eid, type: 'EPISODE' },
    ...(opts.thread ? { thread: opts.thread } : {}),
    author: opts.author,
    authorAssociation: opts.authorAssociation ?? 'NORMAL',
    text: opts.text,
    level: opts.level ?? 0,
    likeCount: opts.likeCount ?? 0,
    liked: opts.liked ?? false,
    collected: opts.collected ?? false,
    createdAt: opts.createdAt,
    status: 'NORMAL',
    permissions: [],
    pid: opts.eid,
    pinned: opts.pinned ?? false,
    isAuthorMuted: false,
    entities: [],
    badges: [],
    ipLoc: opts.author.ipLoc,
    ...(opts.threadReplyCount ? { threadReplyCount: opts.threadReplyCount } : {}),
  }
}

/** 主打单集的 10 条热评（含置顶、主播回复、当前用户自己的评论） */
const featuredComments: Comment[] = [
  makeComment({ id: 'c-mock-eid-01', eid: 'mock-eid', author: usersByUid['u-023'], text: '27:30 那一封听众来信直接把我看哭了。深夜里有人愿意这样认真地写一段话，太珍贵了。', createdAt: hoursAfter(daysAgo(2, 20, 45), 1), likeCount: 128, liked: true, collected: true, pinned: true, threadReplyCount: 3 }),
  makeComment({ id: 'c-mock-eid-02', eid: 'mock-eid', author: usersByUid['u-025'], text: '“写作不是为了被理解，而是为了理解自己。”这句话我抄在了笔记本第一页。', createdAt: hoursAfter(daysAgo(2, 21, 10), 2), likeCount: 96, collected: true, threadReplyCount: 2 }),
  makeComment({ id: 'c-mock-eid-03', eid: 'mock-eid', author: usersByUid['u-001'], text: '谢谢大家听到这里。那封来信是阿桃先读到的，我们在录音前对着稿子沉默了很久。', createdAt: hoursAfter(daysAgo(2, 21, 30), 3), likeCount: 210, liked: true, threadReplyCount: 4, authorAssociation: 'OWNER' }),
  makeComment({ id: 'c-mock-eid-04', eid: 'mock-eid', author: usersByUid['u-021'], text: '通勤路上听完的，到公司楼下坐了十分钟不想上楼。', createdAt: hoursAfter(daysAgo(1, 8, 20), 1), likeCount: 44 }),
  makeComment({ id: 'c-mock-eid-05', eid: 'mock-eid', author: me, text: '我也习惯在凌晨写东西。今天听完这期，终于知道自己为什么总是在那个时间打开电脑了。', createdAt: hoursAfter(daysAgo(1, 23, 10), 1), likeCount: 12, liked: true }),
  makeComment({ id: 'c-mock-eid-06', eid: 'mock-eid', author: usersByUid['u-022'], text: '请问嘉宾提到的那个写作练习具体是什么？想跟着做一周。', createdAt: hoursAfter(daysAgo(1, 10, 0), 2), likeCount: 18, threadReplyCount: 2 }),
  makeComment({ id: 'c-mock-eid-07', eid: 'mock-eid', author: usersByUid['u-026'], text: '大四在宿舍听，忽然很想给三年后的自己写一封信。', createdAt: hoursAfter(daysAgo(0, 9, 30), 1), likeCount: 31 }),
  makeComment({ id: 'c-mock-eid-08', eid: 'mock-eid', author: usersByUid['u-024'], text: '建议做一期「发出去的草稿」主题，应该会很好哭。', createdAt: hoursAfter(daysAgo(0, 12, 10), 2), likeCount: 9 }),
  makeComment({ id: 'c-mock-eid-09', eid: 'mock-eid', author: usersByUid['u-002'], text: '片尾音乐也来自听众推荐哦，感谢 Nocturne 的授权。', createdAt: hoursAfter(daysAgo(0, 14, 5), 3), likeCount: 26, authorAssociation: 'OWNER' }),
  makeComment({ id: 'c-mock-eid-10', eid: 'mock-eid', author: usersByUid['u-003'], text: '从心理咨询的角度看，「把句子留给明天」其实是一种很好的睡前仪式。', createdAt: hoursAfter(daysAgo(0, 16, 40), 4), likeCount: 15, collected: true }),
]

/** 主播 / 听众对某条评论的回复（供 comment_thread 使用） */
export const commentReplies: Record<string, Comment[]> = {
  'c-mock-eid-01': [
    makeComment({ id: 'r-c-mock-eid-01-a', eid: 'mock-eid', author: usersByUid['u-002'], text: '谢谢你！那封信我们也保留了下来，后面会再读一次。', createdAt: hoursAfter(daysAgo(2, 21, 5), 3), likeCount: 34, level: 1, thread: 'c-mock-eid-01', authorAssociation: 'OWNER' }),
    makeComment({ id: 'r-c-mock-eid-01-b', eid: 'mock-eid', author: usersByUid['u-023'], text: '期待！', createdAt: hoursAfter(daysAgo(1, 9, 0), 1), likeCount: 5, level: 1, thread: 'c-mock-eid-01' }),
    makeComment({ id: 'r-c-mock-eid-01-c', eid: 'mock-eid', author: usersByUid['u-026'], text: '同哭了，抱抱楼上的自己。', createdAt: hoursAfter(daysAgo(1, 11, 0), 1), likeCount: 3, level: 1, thread: 'c-mock-eid-01' }),
  ],
  'c-mock-eid-02': [
    makeComment({ id: 'r-c-mock-eid-02-a', eid: 'mock-eid', author: usersByUid['u-001'], text: '这句话是林一在节目最后说的，我们也很喜欢。', createdAt: hoursAfter(daysAgo(2, 22, 0), 1), likeCount: 22, level: 1, thread: 'c-mock-eid-02', authorAssociation: 'OWNER' }),
    makeComment({ id: 'r-c-mock-eid-02-b', eid: 'mock-eid', author: usersByUid['u-025'], text: '原来如此，谢谢主播回复！', createdAt: hoursAfter(daysAgo(1, 8, 0), 2), likeCount: 6, level: 1, thread: 'c-mock-eid-02' }),
  ],
  'c-mock-eid-03': [
    makeComment({ id: 'r-c-mock-eid-03-a', eid: 'mock-eid', author: usersByUid['u-006'], text: '谢谢你们把这封来信读得那么轻。', createdAt: hoursAfter(daysAgo(2, 23, 0), 2), likeCount: 18, level: 1, thread: 'c-mock-eid-03' }),
    makeComment({ id: 'r-c-mock-eid-03-b', eid: 'mock-eid', author: usersByUid['u-022'], text: '主播回复好温柔。', createdAt: hoursAfter(daysAgo(2, 23, 30), 3), likeCount: 7, level: 1, thread: 'c-mock-eid-03' }),
    makeComment({ id: 'r-c-mock-eid-03-c', eid: 'mock-eid', author: usersByUid['u-024'], text: '+1，这期值得二刷。', createdAt: hoursAfter(daysAgo(1, 7, 0), 4), likeCount: 4, level: 1, thread: 'c-mock-eid-03' }),
    makeComment({ id: 'r-c-mock-eid-03-d', eid: 'mock-eid', author: usersByUid['u-021'], text: '已经推荐给同事了。', createdAt: hoursAfter(daysAgo(1, 13, 0), 5), likeCount: 2, level: 1, thread: 'c-mock-eid-03' }),
  ],
  'c-mock-eid-06': [
    makeComment({ id: 'r-c-mock-eid-06-a', eid: 'mock-eid', author: usersByUid['u-002'], text: '练习一：每天写三行，不修改。练习二：把一段旧草稿读出声。练习三：给三个月后的自己写一封信。', createdAt: hoursAfter(daysAgo(1, 11, 0), 3), likeCount: 41, level: 1, thread: 'c-mock-eid-06', authorAssociation: 'OWNER' }),
    makeComment({ id: 'r-c-mock-eid-06-b', eid: 'mock-eid', author: usersByUid['u-022'], text: '收到！今晚就开始。', createdAt: hoursAfter(daysAgo(0, 9, 0), 1), likeCount: 5, level: 1, thread: 'c-mock-eid-06' }),
  ],
}

/** 所有单集的评论（任意 eid 至少 4 条，主打单集 10 条） */
export const commentsByEpisode: Record<string, Comment[]> = {}

for (const episode of episodes) {
  if (episode.eid === 'mock-eid') {
    commentsByEpisode[episode.eid] = featuredComments
    continue
  }
  commentsByEpisode[episode.eid] = GENERIC_COMMENT_TEXTS.slice(0, 4).map((text, i) => {
    const author = listeners[i % listeners.length]
    return makeComment({
      id: `c-${episode.eid}-${i + 1}`,
      eid: episode.eid,
      author,
      text,
      createdAt: hoursAfter(episode.pubDate, 2 + i * 5),
      likeCount: 8 + ((i + 1) * 17) % 60,
      liked: i === 0,
      collected: i === 0,
      pinned: i === 0 && episode.isPicked,
    })
  })
}

/** 我的评论（/comment_list_mine）：真实响应带 episode，供「我的评论」页展示和跳转 */
const myCommentSeeds = [
  {
    eid: 'mock-eid',
    text: '我也习惯在凌晨写东西。今天听完这期，终于知道自己为什么总是在那个时间打开电脑了。',
    likeCount: 12,
    createdAt: hoursAfter(daysAgo(1, 23, 10), 1),
  },
  {
    eid: 'pod-006-ep-1',
    text: '夜班司机那期是凌晨听完的，城市的声音被收进了耳机里。',
    likeCount: 6,
    createdAt: daysAgo(3, 22, 30),
  },
  {
    eid: 'pod-008-ep-2',
    text: '重看《花样年华》时才听懂主播说的「没说出口」是什么意思。',
    likeCount: 3,
    createdAt: daysAgo(5, 20, 0),
  },
]

export const myComments: (Comment & { episode?: EpisodeBasic })[] = myCommentSeeds.map(
  (seed, index) => {
    const base = commentsByEpisode[seed.eid]?.[0] ?? featuredComments[0]
    return {
      ...base,
      ...makeComment({
        id: `my-comment-${index + 1}`,
        eid: seed.eid,
        author: me,
        text: seed.text,
        createdAt: seed.createdAt,
        likeCount: seed.likeCount,
      }),
      episode: episodesByEid[seed.eid],
    }
  },
)

/** 我收藏的评论（comment_collect_list 端点） */
export const collectedComments: Comment[] = [
  { ...featuredComments[0], id: 'collected-1', collected: true },
  { ...featuredComments[1], id: 'collected-2', collected: true },
  { ...featuredComments[9], id: 'collected-3', collected: true },
  { ...(commentsByEpisode['pod-002-ep-1']?.[0] ?? featuredComments[3]), id: 'collected-4', collected: true },
  { ...(commentsByEpisode['pod-008-ep-1']?.[0] ?? featuredComments[4]), id: 'collected-5', collected: true },
]

// ---------------------------------------------------------------------------
// 发现页（/discovery）
// ---------------------------------------------------------------------------

interface NavHeaderItem {
  id: string
  leftImage?: { images: ImageUrls[]; style?: string }
  rightContent?: { type: 'TEXT' | 'IMAGE'; text?: string; image?: ImageUrls }
  url?: string
  backgroundImage?: ImageUrls
}

interface CoverBannerItem {
  id: string
  image: string
  voiceover: string
  url: string
}

interface EpisodeRecommendBlock {
  title: string
  targetType: 'EPISODE'
  target: { episode: EpisodeBasic; recommendation?: string }[]
}

interface EditorPickBlock {
  picks: EditorPickItem[]
}

function editorNote(eid: string, text: string, index: number): Comment {
  const target = episodesByEid[eid]
  return makeComment({
    id: `editor-note-${index + 1}-${eid}`,
    eid,
    author: usersByUid['u-003'],
    text,
    createdAt: daysAgo(1, 19, 0),
    likeCount: 60 + index * 11,
    collected: index % 2 === 0,
    authorAssociation: 'EDITOR',
    level: 1,
    thread: `editor-pick-${target.pid}`,
  })
}

const quickNavItems: NavHeaderItem[] = [
  {
    id: 'nav-hot',
    leftImage: { images: [createImageUrls('nav-hot', 256)], style: 'ROUND' },
    rightContent: { type: 'TEXT', text: '本周热门' },
    url: '/toplist/HOT',
  },
  {
    id: 'nav-new',
    leftImage: { images: [createImageUrls('nav-new', 256)], style: 'ROUND' },
    rightContent: { type: 'TEXT', text: '新星榜' },
    url: '/toplist/NEW',
  },
  {
    id: 'nav-rock',
    leftImage: { images: [createImageUrls('nav-rock', 256)], style: 'ROUND' },
    rightContent: { type: 'TEXT', text: '潜力新声' },
    url: '/toplist/ROCK',
  },
  {
    id: 'nav-picks',
    leftImage: { images: [createImageUrls('nav-picks', 256)], style: 'ROUND' },
    rightContent: { type: 'TEXT', text: '编辑精选' },
    url: '/editor-picks',
  },
]

const coverBanners: CoverBannerItem[] = [
  {
    id: 'banner-1',
    image: wideImage('banner-night-writing', 1600, 640),
    voiceover: '本周专题 · 深夜写作的人，都在和什么对话？',
    url: '/episode/mock-eid',
  },
  {
    id: 'banner-2',
    image: wideImage('banner-new-stars', 1600, 640),
    voiceover: '新星榜上线：听见那些刚刚开始的声音',
    url: '/toplist/NEW',
  },
  {
    id: 'banner-3',
    image: wideImage('banner-weekly-picks', 1600, 640),
    voiceover: '编辑精选 · 这一周，我们反复听了这 5 期',
    url: '/editor-picks',
  },
]

function recommendSection(
  title: string,
  eids: string[],
  recommendations: string[],
): { type: 'DISCOVERY_EPISODE_RECOMMEND'; data: EpisodeRecommendBlock } {
  const target = eids
    .filter((eid) => Boolean(episodesByEid[eid]))
    .map((eid, index) => ({
      episode: episodesByEid[eid],
      recommendation: recommendations[index % recommendations.length],
    }))
  return { type: 'DISCOVERY_EPISODE_RECOMMEND', data: { title, targetType: 'EPISODE', target } }
}

function editorPickSection(picks: { eid: string; note: string }[]): { type: 'EDITOR_PICK'; data: EditorPickBlock } {
  return {
    type: 'EDITOR_PICK',
    data: {
      picks: picks.map((pick, index) => ({
        episode: episodesByEid[pick.eid],
        comment: editorNote(pick.eid, pick.note, index),
      })),
    },
  }
}

function navHeaderSection(items: NavHeaderItem[]): { type: 'DISCOVERY_HEADER'; data: NavHeaderItem[] } {
  return { type: 'DISCOVERY_HEADER', data: items }
}

function bannerSection(items: CoverBannerItem[]): { type: 'DISCOVERY_COVER_BANNER'; data: CoverBannerItem[] } {
  return { type: 'DISCOVERY_COVER_BANNER', data: items }
}

/** 第一页：首页主体 */
export const discoveryPage1: DiscoveryResponse = {
  loadMoreKey: 'mock-discovery-page-2',
  data: [
    navHeaderSection(quickNavItems),
    bannerSection(coverBanners),
    recommendSection(
      '编辑推荐 · 夜深了，听点什么',
      ['mock-eid', 'pod-002-ep-1', 'pod-006-ep-1', 'pod-005-ep-1', 'pod-010-ep-1', 'pod-004-ep-2'],
      ['适合关灯后慢慢听', '给最近情绪低落的人', '城市另一面的声音', '书店打烊之后', '一首歌的来路', '菜市场的清晨'],
    ),
    editorPickSection([
      { eid: 'mock-eid', note: '一封来信，让两个主播在录音间里沉默了很久。' },
      { eid: 'pod-003-ep-1', note: '当工具越来越聪明，人的手艺还剩下什么。' },
      { eid: 'pod-009-ep-1', note: '一个人去看海的六个小时，值得。' },
      { eid: 'pod-007-ep-2', note: '一份不加滤镜的失败复盘。' },
      { eid: 'pod-008-ep-1', note: '重看《花样年华》的第 17 遍。' },
    ]),
    recommendSection(
      '新声力量 · 值得关注的播客',
      ['pod-006-ep-2', 'pod-002-ep-3', 'pod-010-ep-3', 'pod-005-ep-2', 'pod-004-ep-3'],
      ['凌晨的便利店灯光', '停止和自己打架', '走进乐手的地下室', '一本旧书的重逢', '发酵带来的漫长等待'],
    ),
  ],
}

/** 第二页：首页「Load More」之后追加的内容 */
export const discoveryPage2: DiscoveryResponse = {
  data: [
    recommendSection(
      '通勤时间 · 60 分钟刚刚好',
      ['mock-pid-ep-2', 'pod-003-ep-3', 'pod-007-ep-1', 'pod-008-ep-3', 'pod-009-ep-2', 'mock-pid-ep-3'],
      ['一份不着急读完的书单', '程序员的第二职业曲线', '烧完最后一笔钱之后', '恐怖片的叙事引擎', '高原上的失眠'],
    ),
    editorPickSection([
      { eid: 'pod-004-ep-4', note: '早餐摊主的三点起床闹钟。' },
      { eid: 'pod-002-ep-5', note: '咨询师最想放弃的那一刻。' },
      { eid: 'mock-pid-ep-3', note: '从一份早餐开始的迁徙。' },
    ]),
  ],
}

// ---------------------------------------------------------------------------
// 榜单 / 编辑精选 / 首发 / 搜索预设
// ---------------------------------------------------------------------------

const byPlayCount = (a: EpisodeBasic, b: EpisodeBasic) => b.playCount - a.playCount
const byPubDate = (a: EpisodeBasic, b: EpisodeBasic) =>
  new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()

/** 三个榜单：HOT 热门 / ROCK 潜力榜 / NEW 新星榜 */
export const topLists: Record<'HOT' | 'ROCK' | 'NEW', EpisodeBasic[]> = {
  HOT: [...episodes].sort(byPlayCount).slice(0, 10),
  ROCK: [...episodes]
    .sort((a, b) => a.podcast.subscriptionCount - b.podcast.subscriptionCount || byPlayCount(a, b))
    .slice(0, 10),
  NEW: [...episodes].sort(byPubDate).slice(0, 10),
}

/** 编辑精选历史（/editor_pick_list_history），按日期分组（comment 用字符串，兼容当前页面渲染） */
export const editorPickHistory: { date: string; dateIsoStr: string; picks: unknown[] }[] = [
  {
    date: daysAgo(1),
    dateIsoStr: daysAgo(1),
    picks: [
      { episode: episodesByEid['mock-eid'], comment: '一封来信，让两个主播在录音间里沉默了很久。' },
      { episode: episodesByEid['pod-003-ep-1'], comment: '当工具越来越聪明，人的手艺还剩下什么。' },
      { episode: episodesByEid['pod-009-ep-1'], comment: '一个人去看海的六个小时，值得。' },
    ],
  },
  {
    date: daysAgo(2),
    dateIsoStr: daysAgo(2),
    picks: [
      { episode: episodesByEid['pod-006-ep-1'], comment: '夜班司机的城市地图，听得见凌晨的呼吸。' },
      { episode: episodesByEid['pod-007-ep-2'], comment: '一份不加滤镜的失败复盘。' },
    ],
  },
  {
    date: daysAgo(3),
    dateIsoStr: daysAgo(3),
    picks: [
      { episode: episodesByEid['pod-008-ep-1'], comment: '重看《花样年华》的第 17 遍。' },
      { episode: episodesByEid['pod-005-ep-2'], comment: '纸质书提供的是一种关系。' },
      { episode: episodesByEid['pod-004-ep-2'], comment: '菜市场是城市的客厅。' },
    ],
  },
  {
    date: daysAgo(4),
    dateIsoStr: daysAgo(4),
    picks: [
      { episode: episodesByEid['pod-002-ep-2'], comment: '内耗的本质，是两套评价系统在吵架。' },
      { episode: episodesByEid['pod-010-ep-1'], comment: '一首歌的十二道工序。' },
    ],
  },
  {
    date: daysAgo(5),
    dateIsoStr: daysAgo(5),
    picks: [
      { episode: episodesByEid['pod-006-ep-2'], comment: '关东煮的热气里，藏着很多没说出口的故事。' },
      { episode: episodesByEid['pod-005-ep-3'], comment: '书店打烊后的那场聊天。' },
      { episode: episodesByEid['pod-004-ep-1'], comment: '一碗面里的地方志。' },
    ],
  },
]

/** 首发单集（/pilot_discovery_list） */
export const pilotDiscovery: EpisodeBasic[] = [
  'pod-003-ep-1',
  'pod-002-ep-1',
  'pod-006-ep-1',
  'pod-005-ep-1',
  'pod-010-ep-1',
  'pod-009-ep-1',
].map((eid) => episodesByEid[eid])

/** 搜索预设词（/search_preset） */
export const searchPresets: SearchPresetItem[] = [
  { type: 'FIXED', text: '深夜电台', link: '/search?keyword=深夜电台', resident: true, readTrackInfo: {} },
  { type: 'FIXED', text: '女性成长', link: '/search?keyword=女性成长', resident: false, readTrackInfo: {} },
  { type: 'FIXED', text: 'AI 时代', link: '/search?keyword=AI 时代', resident: false, readTrackInfo: {} },
  { type: 'FIXED', text: '读书', link: '/search?keyword=读书', resident: false, readTrackInfo: {} },
  { type: 'FIXED', text: '城市漫游', link: '/search?keyword=城市漫游', resident: false, readTrackInfo: {} },
  { type: 'FIXED', text: '电影', link: '/search?keyword=电影', resident: false, readTrackInfo: {} },
  { type: 'FIXED', text: '心理学', link: '/search?keyword=心理学', resident: false, readTrackInfo: {} },
  { type: 'FIXED', text: '商业复盘', link: '/search?keyword=商业复盘', resident: false, readTrackInfo: {} },
  { type: 'FIXED', text: '早餐', link: '/search?keyword=早餐', resident: false, readTrackInfo: {} },
  { type: 'FIXED', text: '旅行', link: '/search?keyword=旅行', resident: false, readTrackInfo: {} },
]

// ---------------------------------------------------------------------------
// 分类
// ---------------------------------------------------------------------------

/** 分类列表（/category_list） */
export const categories: CategoryInfo[] = [
  { id: 'cat-arts', name: '人文艺术', emoji: '🎨', icon: createImageUrls('cat-arts', 256) },
  { id: 'cat-psych', name: '心理成长', emoji: '🫧', icon: createImageUrls('cat-psych', 256) },
  { id: 'cat-tech', name: '科技互联网', emoji: '🧪', icon: createImageUrls('cat-tech', 256) },
  { id: 'cat-biz', name: '商业职场', emoji: '💼', icon: createImageUrls('cat-biz', 256) },
  { id: 'cat-life', name: '生活方式', emoji: '🌿', icon: createImageUrls('cat-life', 256) },
  { id: 'cat-book', name: '读书文学', emoji: '📚', icon: createImageUrls('cat-book', 256) },
  { id: 'cat-food', name: '美食', emoji: '🍜', icon: createImageUrls('cat-food', 256) },
  { id: 'cat-music', name: '音乐', emoji: '🎵', icon: createImageUrls('cat-music', 256) },
  { id: 'cat-movie', name: '影视', emoji: '🎬', icon: createImageUrls('cat-movie', 256) },
  { id: 'cat-travel', name: '旅行户外', emoji: '🧭', icon: createImageUrls('cat-travel', 256) },
  { id: 'cat-sports', name: '运动健康', emoji: '🏃', icon: createImageUrls('cat-sports', 256) },
  { id: 'cat-kids', name: '亲子家庭', emoji: '🧸', icon: createImageUrls('cat-kids', 256) },
]

/** 分类下的 tab（/category_list_tab），第一个 tab 是「全部」 */
export const categoryTabs: Record<string, CategoryTab[]> = Object.fromEntries(
  categories.map((category) => [
    category.id,
    [
      { id: 'all', name: '全部' },
      { id: 'hot', name: '热门' },
      { id: 'new', name: '最新' },
    ],
  ]),
)

const podcastCategories: Record<string, string> = Object.fromEntries(
  podcastSeeds.map((seed) => [seed.pid, seed.categoryId]),
)

/** 分类下的播客（/category_podcast_list），供 CategoryDetail 使用 */
export const categoryPodcasts: Record<string, PodcastBasic[]> = Object.fromEntries(
  categories.map((category) => {
    const matched = podcasts.filter((podcast) => podcastCategories[podcast.pid] === category.id)
    const filled = matched.length > 0
      ? matched
      : podcasts.filter((podcast) => podcast.pid !== 'mock-pid').slice(0, 4)
    return [category.id, [...filled].sort((a, b) => b.subscriptionCount - a.subscriptionCount)]
  }),
)

// ---------------------------------------------------------------------------
// 订阅 / 收藏 / 最近在听
// ---------------------------------------------------------------------------

/** 我订阅的播客（/subscription），handler 会按 loadMoreKey.skip 分页 */
export const subscriptions: PodcastBasic[] = podcasts

/** 关注动态（/following_updates_list）：听友推荐了哪一期，结构对齐真实抓包 */
export const followingUpdates = [
  {
    id: 'following-1',
    actionType: 'PICK',
    item: {
      id: 'pick-1',
      type: 'PICK',
      story: { emotion: 'HAPPY', text: '通勤路上听完的，推荐给同样在深夜写东西的人。', iconUrl: '' },
      episode: episodesByEid['mock-eid'],
      user: usersByUid['u-022'],
      pickedAt: hoursAgo(2),
      likeCount: 3,
      commentCount: 1,
      isLiked: false,
    },
  },
  {
    id: 'following-2',
    actionType: 'PICK',
    item: {
      id: 'pick-2',
      type: 'PICK',
      story: { emotion: 'CALM', text: '夜班司机那期听到凌晨，城市的声音都被收进去了。', iconUrl: '' },
      episode: episodesByEid['pod-006-ep-1'],
      user: usersByUid['u-023'],
      pickedAt: daysAgo(1, 22, 10),
      likeCount: 1,
      commentCount: 0,
      isLiked: false,
    },
  },
  {
    id: 'following-3',
    actionType: 'PICK',
    item: {
      id: 'pick-3',
      type: 'PICK',
      story: { emotion: 'HAPPY', text: '这期的信息密度很高，适合二刷。', iconUrl: '' },
      episode: episodesByEid['pod-004-ep-2'],
      user: usersByUid['u-026'],
      pickedAt: daysAgo(3, 9, 0),
      likeCount: 0,
      commentCount: 0,
      isLiked: false,
    },
  },
]

/** 常听节目（/subscription_often_played），订阅页顶部货架使用 */
export const oftenPlayedPodcasts: PodcastBasic[] = podcasts.slice(0, 6)

/**
 * 收件箱：订阅的节目最近更新的单集（/inbox_list）。
 * 取全部单集按发布时间倒序，相当于「每个订阅节目的最新若干期」混排；handler 按 6 条/页分页。
 */
export const inboxUpdates: EpisodeBasic[] = [...episodes]
  .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
  .slice(0, 14)

/** 未读消息数（/unread_count）。上游只给数字，Mock 固定给 3 让徽标在截图里可见。 */
export const mockUnreadCount = 3

// ---------------------------------------------------------------------------
// 互动通知（/notice_list，静态合同先行）
// ---------------------------------------------------------------------------

/**
 * 互动通知（/notice_list）。
 *
 * **静态合同先行**：`source` / `target`（TypeData）的真实结构、`action` 的枚举值都还要
 * 靠抓包校准（见 docs/API_INVENTORY.md §2.6）。这里刻意混排几种「可能的样子」：
 * - `source: { type:'USER', user:<UserBasic> }` —— 触发通知的人（昵称/头像在这里）
 * - `source: { type:'COMMENT', comment|data }` —— 回复内容（作者是触发者）
 * - `target: { type:'COMMENT'|'EPISODE', ... }` —— 被互动的评论 / 单集（`eid` 来源）
 * 页面只通过 src/api/notice.ts 的安全提取 helper 取值，换结构也不会崩；handler 按
 * 本数组顺序（createdAt 倒序）6 条/页分页。
 */
const legacyNoticeUpdates: Notice[] = [
  // 1) 点赞：触发者 → 我的评论（单集 eid 藏在评论 owner 的 `{type:'EPISODE', id}` 里）
  {
    id: 'notice-like-1',
    uid: 'u-022',
    action: 'LIKE',
    createdAt: minutesAgo(8),
    blockable: true,
    blocked: false,
    source: { type: 'USER', user: usersByUid['u-022'] },
    target: {
      type: 'COMMENT',
      comment: {
        id: 'c-mock-eid-05',
        text: '我也习惯在凌晨写东西。今天听完这期，终于知道自己为什么总是在那个时间打开电脑了。',
        author: mockProfile,
        owner: { id: 'mock-eid', type: 'EPISODE' },
      },
    },
  },

  // 2) 回复：回复内容在 source 里（作者即触发者），原评论在 target
  {
    id: 'notice-reply-1',
    uid: 'u-001',
    action: 'REPLY',
    createdAt: minutesAgo(25),
    blockable: true,
    source: {
      type: 'COMMENT',
      comment: {
        id: 'c-mock-eid-03',
        text: '谢谢大家听到这里。那封来信是阿桃先读到的，我们在录音前对着稿子沉默了很久。',
        author: usersByUid['u-001'],
        owner: { id: 'mock-eid', type: 'EPISODE' },
      },
    },
    target: {
      type: 'COMMENT',
      comment: {
        id: 'c-mock-eid-05',
        text: '我也习惯在凌晨写东西。今天听完这期，终于知道自己为什么总是在那个时间打开电脑了。',
        author: mockProfile,
        owner: { id: 'mock-eid', type: 'EPISODE' },
      },
    },
  },

  // 3) 点赞：target 是评论，owner.id 是 eid
  {
    id: 'notice-like-2',
    uid: 'u-021',
    action: 'LIKE',
    createdAt: hoursAgo(1.5),
    blockable: true,
    source: { type: 'USER', user: usersByUid['u-021'] },
    target: {
      type: 'COMMENT',
      comment: {
        id: 'c-pod-004-ep-1-1',
        text: '一碗面里能读出一座城市的移民史，这期听饿了也听哭了。',
        owner: { id: 'pod-004-ep-1', type: 'EPISODE' },
      },
    },
  },

  // 4) 回复：多态实体换个包裹键（data 而不是 comment）
  {
    id: 'notice-reply-3',
    uid: 'u-026',
    action: 'REPLY',
    createdAt: hoursAgo(3),
    source: {
      type: 'COMMENT',
      data: {
        text: '这段读得太好了，听完立刻去重读了一遍《百年孤独》的开头。',
        author: usersByUid['u-026'],
        owner: { id: 'pod-005-ep-1', type: 'EPISODE' },
      },
    },
    target: null,
  },

  // 5) 关注：没有可跳转单集（该行应不可点）
  {
    id: 'notice-follow-1',
    uid: 'u-023',
    action: 'FOLLOW',
    createdAt: hoursAgo(5),
    blockable: false,
    source: { type: 'USER', user: usersByUid['u-023'] },
    target: { type: 'USER', user: mockProfile },
  },

  // 6) 点赞：action 小写；单集信息直接在 target 里（摘要回落到单集标题）
  {
    id: 'notice-like-3',
    uid: 'u-025',
    action: 'like',
    createdAt: hoursAgo(8),
    source: { type: 'USER', user: usersByUid['u-025'] },
    target: {
      type: 'EPISODE',
      episode: { eid: 'pod-008-ep-1', title: '073 重看《花样年华》的四个瞬间' },
    },
  },

  // 7) 提及：action 认不出 → 未知类（Bell 图标），但摘要与 eid 仍可挖出来
  {
    id: 'notice-mention-1',
    uid: 'u-021',
    action: 'MENTION',
    createdAt: hoursAgo(12),
    source: {
      type: 'COMMENT',
      comment: {
        text: '@晚风 这段是不是你上次说的那种感觉。',
        author: usersByUid['u-021'],
        owner: { id: 'pod-007-ep-1', type: 'EPISODE' },
      },
    },
  },

  // 8) 未知：Story 互动，嵌套两层里才有 episode.eid
  {
    id: 'notice-story-1',
    uid: 'u-024',
    action: 'STORY_INTERACTION',
    createdAt: hoursAgo(20),
    source: {
      type: 'STORY',
      data: {
        id: 'story-mock-1',
        text: '这个片段太戳了，循环看了三遍。',
        episode: { eid: 'pod-006-ep-1', title: '031 夜班司机的城市地图' },
        author: usersByUid['u-024'],
      },
    },
  },

  // 9) 未知：系统通知（来源为空 → 渲染兜底昵称，且不可点）
  {
    id: 'notice-system-1',
    uid: '',
    action: 'ANNOUNCEMENT',
    createdAt: hoursAgo(26),
    source: null,
    target: { type: 'SYSTEM', text: '小宇宙网页版新增了收听进度同步，欢迎体验。' },
  },

  // 10) 点赞：另一条评论
  {
    id: 'notice-like-5',
    uid: 'u-024',
    action: 'LIKE',
    createdAt: hoursAgo(30),
    source: { type: 'USER', user: usersByUid['u-024'] },
    target: {
      type: 'COMMENT',
      comment: {
        text: '耳机里的私人宇宙，这段描述太准确了。',
        author: mockProfile,
        owner: { id: 'pod-010-ep-1', type: 'EPISODE' },
      },
    },
  },

  // 11) 点赞：触发者信息缺失（只有 uid）→ 昵称走「一位听友」兜底
  {
    id: 'notice-like-4',
    uid: 'u-999',
    action: 'LIKE',
    createdAt: daysAgo(2, 20, 10),
    source: { type: 'USER', data: { uid: 'u-999' } },
    target: {
      type: 'COMMENT',
      comment: {
        text: 'AI 时代手艺人的价值这段，值得反复听。',
        owner: { id: 'pod-003-ep-1', type: 'EPISODE' },
      },
    },
  },

  // 12) 回复：主播回复我
  {
    id: 'notice-reply-2',
    uid: 'u-002',
    action: 'REPLY',
    createdAt: daysAgo(3, 9, 30),
    source: {
      type: 'COMMENT',
      comment: {
        text: '收到，下一期就聊「发出去的草稿」，谢谢你把这个想法写出来。',
        author: usersByUid['u-002'],
        owner: { id: 'mock-eid', type: 'EPISODE' },
      },
    },
    target: {
      type: 'COMMENT',
      comment: {
        text: '建议做一期「发出去的草稿」主题，应该会很好哭。',
        author: mockProfile,
        owner: { id: 'mock-eid', type: 'EPISODE' },
      },
    },
  },

  // 13) 回复：eid 只在 target 更深一层的 episode 里（测试递归深入）
  {
    id: 'notice-reply-4',
    uid: 'u-003',
    action: 'REPLY',
    createdAt: daysAgo(4, 21, 40),
    source: {
      type: 'COMMENT',
      comment: {
        text: '「把句子留给明天」这句很适合当睡前仪式，谢谢你写下来。',
        author: usersByUid['u-003'],
      },
    },
    target: {
      type: 'COMMENT',
      comment: {
        text: '我也习惯在凌晨写东西。今天听完这期，终于知道自己为什么总是在那个时间打开电脑了。',
        author: mockProfile,
        payload: { episode: { eid: 'mock-eid', title: 'Vol.128 深夜写作的人，都在和什么对话？' } },
      },
    },
  },

  // 14) 关注：更早的一条
  {
    id: 'notice-follow-2',
    uid: 'u-026',
    action: 'FOLLOW',
    createdAt: daysAgo(5, 18, 40),
    source: { type: 'USER', user: usersByUid['u-026'] },
  },
]

/**
 * 互动通知（/notice_list）——真实抓包 2026-11-11 校准后的结构：
 * - LIKE：`target` 是被赞的评论（Comment 本体），`source` 是 `{type:"USER_LIST", users, count}`；
 * - COMMENT：`source` 是对方回复的 Comment（作者=触发者），`target` 是我的原评论；
 * - action 实际枚举：`LIKE` / `COMMENT`（关注推断为 `FOLLOW`）。
 * 上面保留了旧 `REPLY` 与 `{comment:{…}}` 包裹的条目，再统一转成真实形状，
 * 既保证 Mock 与线上一致，也保留了「旧结构也能渲染」的容错回归样本。
 */
function toRealNoticeShape(notice: Notice): Notice {
  const source = notice.source as Record<string, unknown> | undefined
  const target = notice.target as Record<string, unknown> | undefined
  const unwrapComment = (value: unknown): unknown => {
    const record = value as Record<string, unknown> | undefined
    if (!record) return value
    const nested = record.comment ?? record.data
    return nested && typeof nested === 'object' ? nested : value
  }
  const action = notice.action === 'REPLY' ? 'COMMENT' : notice.action
  const sourceComment = unwrapComment(source)
  const targetComment = unwrapComment(target)
  if (action === 'LIKE') {
    const users = Array.isArray(source?.users)
      ? source.users
      : source?.user && typeof source.user === 'object'
        ? [source.user]
        : []
    return {
      ...notice,
      action,
      source: { type: 'USER_LIST', users, count: users.length || 1 },
      target: targetComment,
    }
  }
  if (action === 'COMMENT') {
    return { ...notice, action, source: sourceComment, target: targetComment }
  }
  return { ...notice, action }
}

export const noticeUpdates: Notice[] = legacyNoticeUpdates.map(toRealNoticeShape)

// ---------------------------------------------------------------------------
// 相关单集 / 首页三个 tab（真实抓包 2026-11-11 的结构）
// ---------------------------------------------------------------------------

/** 相关单集推荐（/related_episode_list）：真实接口一次约 10 条，跨节目；mock 取每个节目的最新一期 */
export const relatedEpisodes: EpisodeBasic[] = podcasts
  .map((podcast) => episodesByPid[podcast.pid]?.[0])
  .filter((episode): episode is EpisodeBasic => Boolean(episode))
  .slice(0, 10)

/** 首页活动位（DISCOVERY_HEADER）的 mock 条目：对齐真实分层结构（背景 / 左侧图标 / 右侧文字图 / 主题色） */
function promoEntry(
  seed: string,
  url: string,
  color: { light: string; dark: string } = { light: '#EAF3F9', dark: '#E59997' },
) {
  return {
    id: `promo-${seed}`,
    url,
    backgroundImage: createImageUrls(`promo-bg-${seed}`, 780),
    color,
    leftImage: { images: [createImageUrls(`promo-left-${seed}`, 320)], style: 'ORIGINAL' },
    rightContent: { type: 'IMAGE', image: createImageUrls(`promo-right-${seed}`, 640) },
  }
}

const homePromoHeader: DiscoveryRawSection = {
  type: 'DISCOVERY_HEADER',
  data: [
    promoEntry('run', 'https://www.xiaoyuzhoufm.com/'),
    promoEntry('newforce', '/editor-picks'),
    promoEntry('top', '/toplist/HOT'),
  ],
}

/** 精选 tab（/tab_featured_list）：活动位 + 编辑精选 */
export const homeFeaturedSections: DiscoveryRawSection[] = [
  homePromoHeader,
  { type: 'EDITOR_PICK', data: editorPickHistory[0] ?? { picks: [] } },
]

/** 精选 tab 第二页：DISCOVERY_COLLECTION（节目推荐） */
export const homeFeaturedMoreSections: DiscoveryRawSection[] = [
  {
    type: 'DISCOVERY_COLLECTION',
    data: [
      {
        title: '为你精选的节目',
        targetType: 'PODCAST',
        target: podcasts.slice(0, 4).map((podcast) => ({
          podcast,
          recommendation: `因为你喜欢「${podcast.topicLabels[0] ?? '播客'}」`,
        })),
      },
    ],
  },
]

/** 发现 tab（/tab_discovery_list）：活动位、单集推荐、视频播客、三个榜单 */
export const homeDiscoverySections: DiscoveryRawSection[] = [
  homePromoHeader,
  {
    type: 'DISCOVERY_EPISODE_RECOMMEND_V3',
    data: {
      title: '为你推荐',
      target: episodes.slice(0, 5).map((episode) => ({
        episode,
        recommendation: `${episode.podcast.title} · 编辑推荐`,
      })),
    },
  },
  {
    type: 'DISCOVERY_VIDEO_PODCAST',
    data: { title: '视频播客', episodes: episodes.slice(5, 10).map((episode) => ({ episode })) },
  },
  {
    type: 'TOP_LIST',
    data: [
      {
        title: '最热榜',
        category: 'HOT_EPISODES_IN_24_HOURS',
        items: topLists.HOT.slice(0, 3).map((item) => ({ item })),
      },
      {
        title: '锋芒榜',
        category: 'SKYROCKET_EPISODES',
        items: topLists.ROCK.slice(0, 3).map((item) => ({ item })),
      },
      {
        title: '新星榜',
        category: 'NEW_STAR_EPISODES',
        items: topLists.NEW.slice(0, 3).map((item) => ({ item })),
      },
    ],
  },
]

/** 发现 tab 第二页：再来一批推荐 */
export const homeDiscoveryMoreSections: DiscoveryRawSection[] = [
  {
    type: 'DISCOVERY_EPISODE_RECOMMEND_V3',
    data: {
      title: '再听一批',
      target: episodes.slice(10, 15).map((episode) => ({
        episode,
        recommendation: '和你最近听过的节目相似',
      })),
    },
  },
]

/** 分类 tab（/tab_category_list）：EPISODE_CATEGORY_BLOCKS，每块一个分类 */
const homeCategoryBlocks = categories.map((category) => {
  const categoryPodcastList = categoryPodcasts[category.id] ?? podcasts.slice(0, 4)
  const ownEpisodes = categoryPodcastList.flatMap((podcast) =>
    (episodesByPid[podcast.pid] ?? []).slice(0, 1),
  )
  const pool =
    ownEpisodes.length >= 3
      ? ownEpisodes
      : [
          ...ownEpisodes,
          ...episodes
            .filter((episode) => !ownEpisodes.some((own) => own.eid === episode.eid))
            .slice(0, 3 - ownEpisodes.length),
        ]
  return {
    type: 'CATEGORY',
    data: {
      id: category.id,
      name: category.name,
      color: '#E65050',
      icon: category.icon,
      episodes: pool.slice(0, 3),
    },
  }
})

export const homeCategorySections: DiscoveryRawSection[] = [
  { type: 'EPISODE_CATEGORY_BLOCKS', data: homeCategoryBlocks.slice(0, 8) },
]

export const homeCategoryMoreSections: DiscoveryRawSection[] = [
  { type: 'EPISODE_CATEGORY_BLOCKS', data: homeCategoryBlocks.slice(8) },
]

/** 我收藏的单集（/favorite_episode_list） */
export const favoriteEpisodes: EpisodeBasic[] = episodes.filter((episode) => episode.isFavorited)

/** 最近在听（/pick_recent） */
export const pickRecentItems: unknown[] = [
  {
    id: 'recent-1',
    type: 'PICK',
    episode: episodesByEid['mock-eid'],
    progress: 0.62,
    playedAt: hoursAfter(daysAgo(0, 8, 0), 3),
  },
  {
    id: 'recent-2',
    type: 'PICK',
    episode: episodesByEid['pod-006-ep-1'],
    progress: 0.31,
    playedAt: daysAgo(1, 22, 30),
  },
  {
    id: 'recent-3',
    type: 'PICK',
    episode: episodesByEid['pod-010-ep-1'],
    progress: 0.88,
    playedAt: daysAgo(2, 21, 10),
  },
  {
    id: 'recent-4',
    type: 'PICK',
    episode: episodesByEid['pod-003-ep-1'],
    progress: 1,
    playedAt: daysAgo(3, 12, 40),
  },
]

// ---------------------------------------------------------------------------
// 登录 / 发送验证码
// ---------------------------------------------------------------------------

/** POST /login 的返回值（拦截器之后）：token + 嵌套的 profile */
export const mockLoginResponse: LoginResponse & { data: UserProfile } = {
  'x-jike-access-token': 'mock-access-token-xyz-2026',
  'x-jike-refresh-token': 'mock-refresh-token-xyz-2026',
  data: mockProfile,
}

/** POST /refresh_token 的返回值（拦截器之后） */
export const mockRefreshResponse: LoginResponse = {
  'x-jike-access-token': 'mock-access-token-xyz-2026',
  'x-jike-refresh-token': 'mock-refresh-token-xyz-2026',
}

/** POST /profile 的返回值（拦截器之后，authStore 会读 result.data） */
export const mockProfileResponse: { data: UserProfile } = { data: mockProfile }

/** POST /podcast_get_info 的返回值 */
export const mockPodcastGetInfo = { ipLoc: '上海', organization: '小宇宙 Mock 数据组' }

/** 从任意 keyword 生成的搜索结果（供 /search 和 /search?keyword=… 截图用） */
export function keywordMatches(text: string, keyword: string): boolean {
  if (!keyword) return true
  return text.toLowerCase().includes(keyword.toLowerCase())
}

export const fixtures = {
  allUsers,
  podcasts,
  podcastsByPid,
  podcastRelated,
  episodes,
  episodesByPid,
  episodesByEid,
  episodeDetails,
  commentsByEpisode,
  commentReplies,
  collectedComments,
  discoveryPage1,
  discoveryPage2,
  topLists,
  editorPickHistory,
  pilotDiscovery,
  searchPresets,
  categories,
  categoryTabs,
  categoryPodcasts,
  subscriptions,
  inboxUpdates,
  noticeUpdates,
  myComments,
  relatedEpisodes,
  homeFeaturedSections,
  homeFeaturedMoreSections,
  homeDiscoverySections,
  homeDiscoveryMoreSections,
  homeCategorySections,
  homeCategoryMoreSections,
  mockUnreadCount,
  favoriteEpisodes,
  pickRecentItems,
  mockProfile,
  mockLoginResponse,
  mockRefreshResponse,
  mockProfileResponse,
  mockPodcastGetInfo,
  usersByUid,
  keywordMatches,
}

export default fixtures
