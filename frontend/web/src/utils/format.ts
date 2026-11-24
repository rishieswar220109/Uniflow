export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

const moneyFormatters = new Map<string, Intl.NumberFormat>()

function moneyFormatter(currency: string): Intl.NumberFormat {
  const key = currency.toUpperCase()
  const existing = moneyFormatters.get(key)
  if (existing) return existing
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: key,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  moneyFormatters.set(key, formatter)
  return formatter
}

/**
 * Format a backend money string for display. Money is always a fixed
 * two-decimal string from the API, so it is never parsed into a float for
 * storage - only for locale-aware presentation.
 */
export function formatMoney(value: string | number, currency = 'INR'): string {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return `${currency} —`
  try {
    return moneyFormatter(currency).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function formatSignedMoney(
  value: string | number,
  currency = 'INR',
): string {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return `${currency} —`
  const formatted = formatMoney(Math.abs(amount), currency)
  return amount < 0 ? `−${formatted}` : `+${formatted}`
}

/** Parse a `YYYY-MM-DD` date as a local calendar date, not UTC midnight. */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    const fallback = new Date(value)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  )
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = parseDateOnly(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function todayInputValue(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function daysUntil(value: string): number | null {
  const date = parseDateOnly(value)
  if (!date) return null
  const today = parseDateOnly(todayInputValue())
  if (!today) return null
  return Math.round((date.getTime() - today.getTime()) / 86_400_000)
}

export function describeDueDate(value: string): string {
  const days = daysUntil(value)
  if (days === null) return formatShortDate(value)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days < 0) return `${Math.abs(days)} days overdue`
  return `In ${days} days`
}
