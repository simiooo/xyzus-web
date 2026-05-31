export function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    if (s > 0) return `${h}h ${m}m ${s}s`
    return `${h}h ${m}m`
  }
  if (s > 0 && m === 0) return `${s}s`
  return `${m}min`
}

export function formatDurationShort(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatDate(
  dateStr: string,
  options?: { year?: 'numeric'; month?: 'short' | 'numeric'; day?: 'numeric'; hour?: '2-digit'; minute?: '2-digit' },
): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', {
      month: options?.month ?? 'short',
      day: options?.day ?? 'numeric',
      ...(options?.year ? { year: options.year } : {}),
      ...(options?.hour ? { hour: options.hour, minute: options.minute } : {}),
    })
  } catch {
    return dateStr
  }
}

export function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return formatDate(dateStr, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return String(count)
}
