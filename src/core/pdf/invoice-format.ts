const MONTHS_RU = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

export function formatInvoiceDateLong(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) {
    return isoDate
  }
  const year = match[1]
  const month = Number(match[2])
  const day = match[3]
  const monthName = MONTHS_RU[month - 1]
  if (!monthName) {
    return isoDate
  }
  return `${day} ${monthName} ${year} г.`
}

export function formatInvoiceDateFile(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) {
    return isoDate.slice(0, 10)
  }
  return `${match[3]}.${match[2]}.${match[1]}`
}

export function formatInvoiceMoney(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  const [integer, fraction] = Math.abs(safe).toFixed(2).split('.')
  const grouped = (integer ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${safe < 0 ? '-' : ''}${grouped},${fraction}`
}

export function formatInvoiceQuantity(value: number): string {
  if (!Number.isFinite(value)) {
    return '0'
  }
  if (Number.isInteger(value)) {
    return String(value)
  }
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

export function organizationTaxIdLabel(legalName?: string): 'ИИН' | 'БИН' {
  return /^\s*ИП(\s|"|«|$)/i.test(legalName ?? '') ? 'ИИН' : 'БИН'
}

export const DEFAULT_INVOICE_UNIT = 'шт'

export function formatInvoicePartyLine(input: {
  taxLabel: string
  taxId?: string
  name: string
  address?: string
}): string {
  const chunks: string[] = []
  const tax = `${input.taxLabel} ${input.taxId ?? ''}`.trim()
  if (tax) {
    chunks.push(tax)
  }
  if (input.name.trim()) {
    chunks.push(input.name.trim())
  }
  if (input.address?.trim()) {
    chunks.push(input.address.trim())
  }
  return chunks.join(', ')
}

export function saleInvoicePdfFilename(invoiceNumber: string, isoDate: string): string {
  return `Счёт на оплату №${invoiceNumber} от ${formatInvoiceDateFile(isoDate)}.pdf`
}

export const DEFAULT_SALE_INVOICE_WARNING =
  'Внимание! Оплата данного счета означает согласие с условиями поставки товара. Уведомление об оплате обязательно, в противном случае не гарантируется наличие товара на складе. Товар отпускается по факту прихода денег на р/с Поставщика, самовывозом, при наличии доверенности и документов удостоверяющих личность.'
