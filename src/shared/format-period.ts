export function formatYearMonth(period: string, locale: 'ru' | 'kk'): string {
  const [yearText, monthText] = period.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!year || !month) {
    return period
  }

  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    locale === 'kk' ? 'kk-KZ' : 'ru-RU',
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}
