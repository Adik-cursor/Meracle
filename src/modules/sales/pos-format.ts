import type { Locale } from '../../core/types'

export function formatMoney(
  value: number,
  locale: Locale,
  currency: string,
): string {
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'
  return `${value.toLocaleString(numberLocale)} ${currency}`
}

export function lastUnitPrice(
  productId: string,
  items: { productId: string; unitPrice: number }[],
): number | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index].productId === productId) {
      return items[index].unitPrice
    }
  }

  return undefined
}
