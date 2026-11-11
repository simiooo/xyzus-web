/** 时长、日期、计数的展示规则。全站唯一，不要在页面里另写一套。 */

const MINUTE = 60
const HOUR = 3600

/** 时长：读起来像人话（「1 小时 5 分」「12 分钟」「48 秒」） */
export function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return ''
  const total = Math.round(seconds)
  if (total < MINUTE) return `${total} 秒`
  const h = Math.floor(total / HOUR)
  const m = Math.floor((total % HOUR) / MINUTE)
  if (h > 0) {
    return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`
  }
  return `${m} 分钟`
}

/** 时长：播放器与行尾的值用等宽数字（「05:32」「1:05:32」） */
export function formatDurationShort(seconds: number): string {
  if (!seconds || !isFinite(seconds) || seconds < 0) return '00:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / HOUR)
  const m = Math.floor((total % HOUR) / MINUTE)
  const s = total % MINUTE
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function parse(dateStr?: string | number | Date | null): Date | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

/** 绝对日期：默认「3月5日」，跨年时带年份 */
export function formatDate(
  dateStr?: string | number | Date | null,
  options?: { year?: boolean; withTime?: boolean; short?: boolean },
): string {
  const d = parse(dateStr)
  if (!d) return ''

  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  const withYear = options?.year ?? !sameYear

  const parts: string[] = []
  if (withYear) parts.push(`${d.getFullYear()} 年`)
  if (options?.short) {
    parts.push(`${d.getMonth() + 1}月${d.getDate()}日`)
  } else {
    parts.push(`${d.getMonth() + 1} 月 ${d.getDate()} 日`)
  }

  let text = parts.join('')
  if (options?.withTime) {
    text += ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return text
}

/** 相对时间：「刚刚」「12 分钟前」「昨天」「3 天前」「3月5日」 */
export function formatRelativeDate(dateStr?: string | number | Date | null): string {
  const d = parse(dateStr)
  if (!d) return ''

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diffDay = Math.floor((startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000)

  if (diffDay <= 0) return '今天'
  if (diffDay === 1) return '昨天'
  if (diffDay < 7) return `${diffDay} 天前`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} 周前`

  return formatDate(d)
}

/** 计数：中文习惯的「万 / 亿」 */
export function formatCount(count?: number | null): string {
  if (count === undefined || count === null || !isFinite(count)) return '0'
  const n = Math.round(count)
  if (n < 10000) return String(n)
  if (n < 100000000) {
    const w = n / 10000
    return `${w >= 100 ? Math.round(w) : w.toFixed(1).replace(/\.0$/, '')} 万`
  }
  const y = n / 100000000
  return `${y.toFixed(1).replace(/\.0$/, '')} 亿`
}

/** 播放次数：只给模糊的量级，不追求精确 */
export function formatPlayCount(count?: number | null): string {
  if (!count || !isFinite(count)) return ''
  if (count < 10000) return `${count} 次播放`
  return `${formatCount(count)}次播放`
}

/** 把 ISO 时间转成「今天 08:00」「3月5日」这类用于评论的相对时间 */
export function formatCommentTime(dateStr?: string | null): string {
  const d = parse(dateStr)
  if (!d) return ''
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)} 小时前`
  if (diffMin < 60 * 24 * 7) return `${Math.floor(diffMin / (60 * 24))} 天前`
  return formatDate(d)
}

/** 兜底：接口给的字符串可能已经是「xx分钟」这种读法 */
export function safeText(value?: string | null, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  return value.trim() || fallback
}
