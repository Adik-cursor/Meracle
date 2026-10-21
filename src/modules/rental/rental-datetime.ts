export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDatetimeLocalValue(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

export function dayKeyInTimeZone(iso: string, timeZone?: string): string {
  if (!timeZone) {
    return dayKey(iso)
  }

  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return dayKey(iso)
  }
}

export function formatDateTime(
  iso: string,
  locale: 'ru' | 'kk',
  timeZone?: string,
): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return date.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    timeZone: timeZone || undefined,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00`)
  date.setDate(date.getDate() + days)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function addMonths(isoDay: string, months: number): string {
  const year = Number(isoDay.slice(0, 4))
  const month = Number(isoDay.slice(5, 7)) - 1
  const date = new Date(year, month + months, 1)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`
}

export function startOfWeek(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00`)
  const weekday = date.getDay()
  const shift = weekday === 0 ? -6 : 1 - weekday
  return addDays(isoDay, shift)
}

export function startOfMonth(isoDay: string): string {
  return `${isoDay.slice(0, 8)}01`
}

export function daysInMonth(isoDay: string): number {
  const year = Number(isoDay.slice(0, 4))
  const month = Number(isoDay.slice(5, 7))
  return new Date(year, month, 0).getDate()
}

export function bookingTouchesDay(
  startAt: string,
  endAt: string,
  day: string,
  timeZone?: string,
): boolean {
  const start = dayKeyInTimeZone(startAt, timeZone)
  const endExclusive = dayKeyInTimeZone(endAt, timeZone)
  if (endAt.endsWith('T00:00:00.000Z') || endAt.slice(11, 16) === '00:00') {
    return start <= day && day < endExclusive
  }
  return start <= day && day <= endExclusive
}
